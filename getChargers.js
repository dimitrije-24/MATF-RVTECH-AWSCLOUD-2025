exports.getChargers = async() => {
    console.log("Getting chargers...");

    return {
        statusCode: 200,
        body: JSON.stringify({chargers: ["Charger1","Charger2","Charger3"]}),
    };
};