/**
 * Agentic Memory System - Complete Example
 * 
 * This example demonstrates the full capabilities of the agentic memory system
 * including storage operations, memory consolidation, and advanced features.
 */

import { createAgenticMemory } from './implementation';

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
    "I'm a software engineer at Akieni and I prefer TypeScript for development",
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
 * Main example runner
 */
async function runExamples() {
  try {
    console.log('Agentic Memory System Examples');
    console.log('=====================================\n');

    await basicMemoryExample();
    await memoryConsolidationExample();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}