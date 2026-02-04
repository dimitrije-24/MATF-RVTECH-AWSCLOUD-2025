const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const OCM_API_KEY = process.env.OCM_API_KEY;
const OCM_URL = process.env.OCM_URL;
const TABLE_NAME = process.env.CHARGERS_TABLE;
const BATCH_SIZE = 25; 

const DYNAMODB_ENDPOINT = process.env.LOCALSTACK_HOSTNAME
  ? `http://${process.env.LOCALSTACK_HOSTNAME}:4566`
  : 'http://localhost:4566';

console.log('DynamoDB endpoint:', DYNAMODB_ENDPOINT);
console.log('OCM API KEY:', OCM_API_KEY);

const client = new DynamoDBClient({
  endpoint: DYNAMODB_ENDPOINT,
  region: 'us-east-1',
});

const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders };
  }

  console.log("Fetching OCM chargers...");

  try {

    const MAX_RESULTS = 1000;
    const params = new URLSearchParams({
      key: OCM_API_KEY,
      countrycode: 'RS',
      maxresults: MAX_RESULTS,
      compact: true,
      verbose: false,
    });

    const response = await fetch(`${OCM_URL}?${params}`);
    const chargers = await response.json();

    const fetchedAll = chargers.length < MAX_RESULTS;
    console.log(`Fetched ${chargers.length} chargers from OCM`);
    console.log(fetchedAll ? 'All chargers fetched' : 'May have more chargers (hit maxresults limit)');
    console.log('Example charger:', JSON.stringify(chargers[0], null, 2));

    const ttl = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60; 
    
    const normalizeTown = (town, postcode) => {
      if (['Belgrad', 'Belgrade', 'Beograd'].includes(town)) return 'Belgrade';
      if (postcode?.startsWith('11')) return 'Belgrade'; 
      return town || 'Unknown';
    };
    
    const items = chargers.map(charger => ({
      chargerId: String(charger.ID),                         
      uuid: charger.UUID,
      town: normalizeTown(charger.AddressInfo?.Town, charger.AddressInfo?.Postcode),  
      townRaw: charger.AddressInfo?.Town || 'Unknown',    
      title: charger.AddressInfo?.Title,
      addressLine1: charger.AddressInfo?.AddressLine1,      
      addressLine2: charger.AddressInfo?.AddressLine2,      
      postcode: charger.AddressInfo?.Postcode,
      latitude: charger.AddressInfo?.Latitude,
      longitude: charger.AddressInfo?.Longitude,
      isRecentlyVerified: charger.IsRecentlyVerified,
      dateCreated: charger.DateCreated,
      dateLastVerified: charger.DateLastVerified,
      dateLastStatusUpdate: charger.DateLastStatusUpdate,
      numberOfPoints: charger.NumberOfPoints,               
      ttl,                    
    }));
    
    const batches = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch.map(item => ({ PutRequest: { Item: item } }))
          }
        }));
      } catch (batchError) {
        console.error('BatchWrite error:', batchError.message);
        throw batchError;
      }
    }
    console.log(`Written ${items.length} chargers to DynamoDB`);

    const currentIds = new Set(items.map(item => item.chargerId));
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'chargerId',
    }));

    console.log("scanResult =>", scanResult);
    const staleIds = (scanResult.Items || [])
      .map(item => item.chargerId)
      .filter(id => !currentIds.has(id));
    console.log("staleIds =>", staleIds);    
    let deletedCount = 0;
    if (staleIds.length > 0) {
      console.log(`Deleting ${staleIds.length} stale records...`);
      const deleteBatches = [];
      for (let i = 0; i < staleIds.length; i += BATCH_SIZE) {
        deleteBatches.push(staleIds.slice(i, i + BATCH_SIZE));
      }
      for (const batch of deleteBatches) {
        try {
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: batch.map(id => ({ DeleteRequest: { Key: { chargerId: id } } }))
            }
          }));
        } catch (deleteError) {
          console.error('Delete batch error:', deleteError.message);
          throw deleteError;
        }
      }
      deletedCount = staleIds.length;
      console.log(`Deleted ${deletedCount} stale records`);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "OCM data synced successfully",
        count: items.length,
        deleted: deletedCount
      }),
    };
  } catch (error) {
    console.error("Error syncing OCM data:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
