/**
 * Agentic Memory System - Complete Example
 * 
 * This example demonstrates the full capabilities of the agentic memory system
 * including storage operations, memory consolidation, and advanced features.
 */

import { AgenticMemory, createAgenticMemory, createCustomAgenticMemory } from './implementation';
import { MemoryStorage, createMemoryStorage, defaultStorageConfig } from './storage';

// Example user data
const USER_ID = 'user123';
const CONTEXT = { userId: USER_ID, timestamp: Date.now() };

/**
 * Basic Memory Operations Example
 */
async function basicMemoryExample() {
  console.log('=== Basic Memory Operations ===');
  
  const memory = await createAgenticMemory();

  // Add initial memories
  await memory.add(
    "I'm a software engineer at Google and I prefer TypeScript for development",
    CONTEXT
  );

  await memory.add(
    "I'm working on a React project and I have a meeting with Sarah every Friday",
    CONTEXT
  );

  await memory.add(
    "I'm allergic to peanuts and I usually work best in the morning around 9-11 AM",
    CONTEXT
  );

  // Search for relevant memories
  const results = await memory.search("What programming languages do I know?", CONTEXT);
  console.log('Search results:', results.map(r => r.content));

}

/**
 * Memory Consolidation Example
 */
async function memoryConsolidationExample() {
  console.log('\n=== Memory Consolidation Example ===');
  
  const memory = await createAgenticMemory();

  // Add initial memory
  await memory.add(
    "I'm a UX designer with 3 years experience",
    CONTEXT
  );

  // Add updated information (should trigger UPDATE action)
  await memory.add(
    "I'm a UX designer with 5 years experience and I use Figma daily",
    CONTEXT
  );

  // Add new information (should trigger ADD action)
  await memory.add(
    "I have a 2-year-old daughter and I'm planning a trip to Japan next month",
    CONTEXT
  );

  // Search to see consolidated memories
  const results = await memory.search("What do you know about me?", CONTEXT);
  console.log('Consolidated memories:', results.map(r => r.content));
}

/**
 * Advanced Storage Operations Example
 */
async function advancedStorageExample() {
  console.log('\n=== Advanced Storage Operations ===');
  
  const memory = await createAgenticMemory();

  // Add memories with timestamps
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);

  await memory.add(
    "I completed the React project yesterday",
    { userId: USER_ID, timestamp: oneDayAgo }
  );

  await memory.add(
    "I started learning Python for data analysis",
    { userId: USER_ID, timestamp: twoDaysAgo }
  );

  await memory.add(
    "I'm feeling better today after recovering from a cold",
    CONTEXT
  );

  // Get memories by date range
  const recentMemories = await memory.getMemoriesByDateRange(
    USER_ID,
    oneDayAgo,
    now,
    10
  );
  console.log('Recent memories:', recentMemories.map(m => ({
    content: m.content,
    timestamp: new Date(m.metadata.timestamp).toISOString()
  })));

  // Get specific memory and update it
  if (recentMemories.length > 0) {
    const memoryId = recentMemories[0].id;
    const originalMemory = await memory.get(memoryId);
    console.log('Original memory:', originalMemory?.content);

    await memory.update(memoryId, "I completed the React project and deployed it to production");
    
    const updatedMemory = await memory.get(memoryId);
    console.log('Updated memory:', updatedMemory?.content);
  }
}

/**
 * Error Handling Example
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  try {
    // Create memory with invalid configuration
    const invalidConfig = {
      url: 'http://invalid-url:6333',
      collectionName: 'test_memory',
    };

    const storage = createMemoryStorage(invalidConfig);
    await storage.initialize(); // This should fail
  } catch (error) {
    console.log('Expected error caught:', error instanceof Error ? error.message : error);
  }

  // Test with valid configuration
  const memory = await createAgenticMemory();
}

/**
 * Custom Configuration Example
 */
async function customConfigurationExample() {
  console.log('\n=== Custom Configuration Example ===');
  
  // Create memory with custom configuration
  const customMemory = await createCustomAgenticMemory();
  
  await customMemory.add(
    "This is stored in a custom memory collection",
    CONTEXT
  );

  const results = await customMemory.search("custom", CONTEXT);
  console.log('Custom collection results:', results.map(r => r.content));
}

/**
 * Main example runner
 */
async function runExamples() {
  try {
    console.log('🧠 Agentic Memory System Examples');
    console.log('=====================================\n');

    await basicMemoryExample();
    await memoryConsolidationExample();
    await advancedStorageExample();
    await errorHandlingExample();
    await customConfigurationExample();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  runExamples,
  basicMemoryExample,
  memoryConsolidationExample,
  advancedStorageExample,
  errorHandlingExample,
  customConfigurationExample,
}; 