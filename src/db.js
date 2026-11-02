require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const config = { region: process.env.AWS_REGION || 'ap-south-1' };

// DynamoDB Local support (for testing without an AWS account)
if (process.env.DYNAMODB_ENDPOINT) {
  config.endpoint = process.env.DYNAMODB_ENDPOINT;
  config.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
}

const client = new DynamoDBClient(config);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

module.exports = {
  client,
  docClient,
  STUDENTS_TABLE: process.env.STUDENTS_TABLE || 'Students',
  ATTENDANCE_TABLE: process.env.ATTENDANCE_TABLE || 'Attendance',
  DATE_INDEX: 'date-index',
};
