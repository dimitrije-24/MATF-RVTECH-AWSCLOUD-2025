# MATF-RVTECH-AWSCLOUD-2025

This project shows users the locations of EV chargers for a specific town. It was created for a cloud computing course using AWS services held at the Faculty of Mathematics during the Fall semester of the 2025/26 academic year.

## Prerequisites

Before running the project, ensure you have the following installed:
* [Docker](https://www.docker.com/) (and Docker Compose)
* [Node.js](https://nodejs.org/) & NPM
* [AWS LocalStack CLI](https://github.com/localstack/aws-local) (`pip install aws-local-cli`)

## How to Run

1. **Clone the repository:**
   ```git clone git@github.com:dimitrije-24/MATF-RVTECH-AWSCLOUD-2025.git```

2. **Start LocalStack and install dependencies:**
    ```sudo docker-compose up -d```
    ```npm install```

3. **Configure Environment Variables:**
    Create a .env file in the root directory and add your Open Charge Map API key. You can register for a free key at Open Charge Map.
    ```OCM_API_KEY=[your_api_key_here]```

4. **Use the Serverless Framework to deploy the Lambda functions and DynamoDB table to LocalStack:**
    ```npx serverless deploy```

5. **After the deployment finishes, look for the endpoint URL in the console output. It should look like this: 
```http://localhost:4566/restapis/ABC123XYZ/dev/_user_request_```

* Copy the API_ID (the part between /restapis/ and /dev/).

* Open web/index.html.

* Find const API_ID = and paste your ID there.

6. **Deploy the Frontend**
Upload the website files to the S3 bucket:

```awslocal s3 sync ./web s3://punjaci-website```

## Usage

Once the sync is complete, you can access the website at the following URL: [http://punjaci-website.s3-website.localhost.localstack.cloud:4566/](http://punjaci-website.s3-website.localhost.localstack.cloud:4566/)

