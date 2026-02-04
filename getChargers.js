const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.CHARGERS_TABLE;

const DYNAMODB_ENDPOINT = process.env.LOCALSTACK_HOSTNAME
  ? `http://${process.env.LOCALSTACK_HOSTNAME}:4566`
  : 'http://localhost:4566';

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

  const town = event.pathParameters?.town;
  if (!town) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Town parameter is required' }),
    };
  }

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'TownIndex',
      KeyConditionExpression: 'town = :town',
      ExpressionAttributeValues: {
        ':town': decodeURIComponent(town),
      },
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        town: decodeURIComponent(town),
        count: result.Items?.length ?? 0,
        chargers: result.Items ?? [],
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};