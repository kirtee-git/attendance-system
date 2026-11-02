const express = require('express');
const { PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, STUDENTS_TABLE, ATTENDANCE_TABLE } = require('../db');
const { validateStudent } = require('../validate');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// CREATE - register a student
router.post('/', wrap(async (req, res) => {
  const errors = validateStudent(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { studentId, name, email, department, year } = req.body;
  const item = {
    studentId: studentId.trim(), name: name.trim(), email, department,
    year: year ? Number(year) : undefined, createdAt: new Date().toISOString(),
  };
  try {
    await docClient.send(new PutCommand({
      TableName: STUDENTS_TABLE, Item: item,
      ConditionExpression: 'attribute_not_exists(studentId)', // prevent duplicates
    }));
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException')
      return res.status(409).json({ error: `Student ${item.studentId} already exists` });
    throw e;
  }
  res.status(201).json(item);
}));

// READ - list all students
router.get('/', wrap(async (req, res) => {
  const { Items } = await docClient.send(new ScanCommand({ TableName: STUDENTS_TABLE }));
  res.json(Items.sort((a, b) => a.studentId.localeCompare(b.studentId)));
}));

// READ - one student
router.get('/:studentId', wrap(async (req, res) => {
  const { Item } = await docClient.send(new GetCommand({ TableName: STUDENTS_TABLE, Key: { studentId: req.params.studentId } }));
  if (!Item) return res.status(404).json({ error: 'Student not found' });
  res.json(Item);
}));

// UPDATE
router.put('/:studentId', wrap(async (req, res) => {
  const errors = validateStudent(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  const allowed = ['name', 'email', 'department', 'year'];
  const sets = [], names = {}, values = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined && req.body[f] !== '') {
      sets.push(`#${f} = :${f}`); names[`#${f}`] = f;
      values[`:${f}`] = f === 'year' ? Number(req.body[f]) : req.body[f];
    }
  });
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  sets.push('#updatedAt = :updatedAt'); names['#updatedAt'] = 'updatedAt'; values[':updatedAt'] = new Date().toISOString();

  try {
    const { Attributes } = await docClient.send(new UpdateCommand({
      TableName: STUDENTS_TABLE, Key: { studentId: req.params.studentId },
      UpdateExpression: 'SET ' + sets.join(', '),
      ExpressionAttributeNames: names, ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(studentId)', ReturnValues: 'ALL_NEW',
    }));
    res.json(Attributes);
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return res.status(404).json({ error: 'Student not found' });
    throw e;
  }
}));

// DELETE - removes student and all of their attendance records
router.delete('/:studentId', wrap(async (req, res) => {
  const { studentId } = req.params;
  try {
    await docClient.send(new DeleteCommand({
      TableName: STUDENTS_TABLE, Key: { studentId }, ConditionExpression: 'attribute_exists(studentId)',
    }));
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return res.status(404).json({ error: 'Student not found' });
    throw e;
  }
  const { Items } = await docClient.send(new QueryCommand({
    TableName: ATTENDANCE_TABLE, KeyConditionExpression: 'studentId = :s',
    ExpressionAttributeValues: { ':s': studentId },
  }));
  for (let i = 0; i < Items.length; i += 25) {
    const chunk = Items.slice(i, i + 25).map((it) => ({ DeleteRequest: { Key: { studentId: it.studentId, date: it.date } } }));
    await docClient.send(new BatchWriteCommand({ RequestItems: { [ATTENDANCE_TABLE]: chunk } }));
  }
  res.json({ message: `Student ${studentId} and ${Items.length} attendance record(s) deleted` });
}));

module.exports = router;
