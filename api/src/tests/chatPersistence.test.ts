const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ChatSessionModule = require('../models/ChatSession');
const ChatSession = ChatSessionModule.default || ChatSessionModule;
// Import app to ensure server import path is exercised but it will not auto-start during tests
const serverModule = require('../server');
const app = serverModule.app || serverModule.default || serverModule;

let mongod: any;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await ChatSession.deleteMany({});
});

test('chat session persists messages and can be retrieved', async () => {
  const chat = await ChatSession.create({
    userId: new mongoose.Types.ObjectId(),
    title: 'Test Chat',
    sourceType: 'note',
    sourceContent: 'This is test content',
    messages: [],
    embeddingStatus: 'completed',
    embeddingProgress: 100,
  });

  chat.messages.push({ role: 'user', content: 'Hello', timestamp: new Date() });
  chat.messages.push({ role: 'assistant', content: 'Hi there', timestamp: new Date() });
  await chat.save();

  const found = await ChatSession.findById(chat._id);
  expect(found).not.toBeNull();
  expect(found.messages.length).toBe(2);
  expect(found.messages[0].content).toBe('Hello');
  expect(found.messages[1].content).toBe('Hi there');
});
