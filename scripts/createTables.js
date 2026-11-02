// Run once:  npm run create-tables
const { CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { client, STUDENTS_TABLE, ATTENDANCE_TABLE, DATE_INDEX } = require('../src/db');

async function createIfMissing(params) {
  const { TableNames } = await client.send(new ListTablesCommand({}));
  if (TableNames.includes(params.TableName)) {
    console.log(`Table "${params.TableName}" already exists - skipping`);
    return;
  }
  await client.send(new CreateTableCommand(params));
  console.log(`Table "${params.TableName}" created`);
}

(async () => {
  try {
    // Students: PK = studentId
    await createIfMissing({
      TableName: STUDENTS_TABLE,
      AttributeDefinitions: [{ AttributeName: 'studentId', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'studentId', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    });

    // Attendance: PK = studentId, SK = date  (all records of a student, sorted by date)
    // GSI date-index: PK = date, SK = studentId (all students on a given date)
    await createIfMissing({
      TableName: ATTENDANCE_TABLE,
      AttributeDefinitions: [
        { AttributeName: 'studentId', AttributeType: 'S' },
        { AttributeName: 'date', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'studentId', KeyType: 'HASH' },
        { AttributeName: 'date', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: DATE_INDEX,
          KeySchema: [
            { AttributeName: 'date', KeyType: 'HASH' },
            { AttributeName: 'studentId', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
    console.log('Done.');
  } catch (err) {
    console.error('Failed to create tables:', err.message);
    process.exit(1);
  }
})();
