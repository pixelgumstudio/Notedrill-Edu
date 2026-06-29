import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ChatSession from '../src/models/ChatSession';

let mongod: MongoMemoryServer;

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
  // Create a chat session
  const chat = await ChatSession.create({
    userId: new mongoose.Types.ObjectId(),
    title: 'Test Chat',
    sourceType: 'note',
    sourceContent: 'This is test content',
    messages: [],
    embeddingStatus: 'completed',
    embeddingProgress: 100,
  });

  // Add messages
  chat.messages.push({ role: 'user', content: 'Hello', timestamp: new Date() } as any);
  chat.messages.push({ role: 'assistant', content: 'Hi there', timestamp: new Date() } as any);
  await chat.save();

  // Retrieve and assert
  const found = await ChatSession.findById(chat._id);
  expect(found).not.toBeNull();
  expect(found!.messages.length).toBe(2);
  expect(found!.messages[0].content).toBe('Hello');
  expect(found!.messages[1].content).toBe('Hi there');
});
