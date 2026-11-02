const express = require('express');
const { PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, STUDENTS_TABLE, ATTENDANCE_TABLE, DATE_INDEX } = require('../db');
const { validateAttendance, isValidDate } = require('../validate');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// CREATE - mark attendance
router.post('/', wrap(async (req, res) => {
  const errors = validateAttendance(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { studentId, date, status, remarks } = req.body;
  const { Item: student } = await docClient.send(new GetCommand({ TableName: STUDENTS_TABLE, Key: { studentId } }));
  if (!student) return res.status(404).json({ error: `Student ${studentId} is not registered` });

  const item = { studentId, date, status, remarks, studentName: student.name, markedAt: new Date().toISOString() };
  try {
    await docClient.send(new PutCommand({
      TableName: ATTENDANCE_TABLE, Item: item,
      ConditionExpression: 'attribute_not_exists(studentId) AND attribute_not_exists(#d)',
      ExpressionAttributeNames: { '#d': 'date' },
    }));
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException')
      return res.status(409).json({ error: 'Attendance already marked for this student on this date. Use update instead.' });
    throw e;
  }
  res.status(201).json(item);
}));

// READ / SEARCH - ?studentId=&date=
router.get('/', wrap(async (req, res) => {
  const { studentId, date } = req.query;
  if (date && !isValidDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  let items;
  if (studentId && date) {
    const { Item } = await docClient.send(new GetCommand({ TableName: ATTENDANCE_TABLE, Key: { studentId, date } }));
    items = Item ? [Item] : [];
  } else if (studentId) {
    ({ Items: items } = await docClient.send(new QueryCommand({
      TableName: ATTENDANCE_TABLE, KeyConditionExpression: 'studentId = :s',
      ExpressionAttributeValues: { ':s': studentId }, ScanIndexForward: false,
    })));
  } else if (date) {
    ({ Items: items } = await docClient.send(new QueryCommand({
      TableName: ATTENDANCE_TABLE, IndexName: DATE_INDEX, KeyConditionExpression: '#d = :d',
      ExpressionAttributeNames: { '#d': 'date' }, ExpressionAttributeValues: { ':d': date },
    })));
  } else {
    ({ Items: items } = await docClient.send(new ScanCommand({ TableName: ATTENDANCE_TABLE, Limit: 200 })));
    items.sort((a, b) => b.date.localeCompare(a.date));
  }
  res.json(items);
}));

// READ - single record
router.get('/:studentId/:date', wrap(async (req, res) => {
  const { studentId, date } = req.params;
  const { Item } = await docClient.send(new GetCommand({ TableName: ATTENDANCE_TABLE, Key: { studentId, date } }));
  if (!Item) return res.status(404).json({ error: 'Attendance record not found' });
  res.json(Item);
}));

// UPDATE
router.put('/:studentId/:date', wrap(async (req, res) => {
  const { studentId, date } = req.params;
  if (!isValidDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const errors = validateAttendance(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  if (req.body.status === undefined && req.body.remarks === undefined)
    return res.status(400).json({ error: 'Provide status and/or remarks' });

  const sets = ['#updatedAt = :u'], names = { '#updatedAt': 'updatedAt' }, values = { ':u': new Date().toISOString() };
  if (req.body.status !== undefined) { sets.push('#status = :status'); names['#status'] = 'status'; values[':status'] = req.body.status; }
  if (req.body.remarks !== undefined) { sets.push('#remarks = :remarks'); names['#remarks'] = 'remarks'; values[':remarks'] = req.body.remarks; }
  names['#d'] = 'date';

  try {
    const { Attributes } = await docClient.send(new UpdateCommand({
      TableName: ATTENDANCE_TABLE, Key: { studentId, date },
      UpdateExpression: 'SET ' + sets.join(', '),
      ConditionExpression: 'attribute_exists(studentId) AND attribute_exists(#d)',
      ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: 'ALL_NEW',
    }));
    res.json(Attributes);
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return res.status(404).json({ error: 'Attendance record not found' });
    throw e;
  }
}));

// DELETE
router.delete('/:studentId/:date', wrap(async (req, res) => {
  const { studentId, date } = req.params;
  try {
    await docClient.send(new DeleteCommand({
      TableName: ATTENDANCE_TABLE, Key: { studentId, date },
      ConditionExpression: 'attribute_exists(studentId)',
    }));
    res.json({ message: 'Attendance record deleted' });
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return res.status(404).json({ error: 'Attendance record not found' });
    throw e;
  }
}));

module.exports = router;
