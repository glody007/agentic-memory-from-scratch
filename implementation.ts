/**
 * Agentic Memory Implementation
 * 
 * This is a minimal implementation example demonstrating the core agentic memory
 * functionality based on Mem0 research. The actual implementation is in lib/memory/.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { MemoryStorage, MemoryMetadata, Memory, MemorySearchParams, createMemoryStorage, defaultStorageConfig } from './storage';

// Memory Actions
export type MemoryAction = {
  type: 'ADD' | 'UPDATE' | 'DELETE' | 'UNCHANGED';
  id?: string;
  text: string;
  oldFact?: string;
};

// Core Memory Class
export class AgenticMemory {
  private storage: MemoryStorage;

  constructor(storage: MemoryStorage) {
    this.storage = storage;
  }

  /**
   * Add new information to memory with intelligent consolidation
   */
  async add(input: string, context: MemoryMetadata): Promise<void> {
    // 1. Extract facts from input
    const facts = await this.extractFacts(input);
    
    // 2. Generate embeddings for each fact
    const factEmbeddings = new Map<string, number[]>();
    for (const fact of facts) {
      const embedding = await this.storage.embedQuery(fact);
      factEmbeddings.set(fact, embedding);
    }

    // 3. Find similar existing memories
    const oldMemories = await this.findSimilarMemories(facts, context.userId);

    // 4. Generate consolidation actions
    const actions = await this.generateConsolidationActions(oldMemories, facts);

    // 5. Apply actions to storage
    await this.applyMemoryActions(actions, factEmbeddings, context);
  }

  /**
   * Search memories using semantic similarity
   */
  async search(query: string, context: MemoryMetadata): Promise<Memory[]> {
    return this.storage.searchMemories({
      userId: context.userId,
      query,
      limit: 10,
      threshold: 0.3,
    });
  }

  /**
   * Get a specific memory by ID
   */
  async get(id: string): Promise<Memory | null> {
    return this.storage.getMemory(id);
  }

  /**
   * Update a specific memory
   */
  async update(id: string, content: string): Promise<void> {
    return this.storage.updateMemory(id, { content });
  }

  /**
   * Delete a specific memory
   */
  async delete(id: string): Promise<void> {
    return this.storage.deleteMemory(id);
  }

  /**
   * Get memories by date range
   */
  async getMemoriesByDateRange(
    userId: string,
    startDate: number,
    endDate: number,
    limit: number = 50
  ): Promise<Memory[]> {
    return this.storage.getMemoriesByDateRange(userId, startDate, endDate, limit);
  }

  /**
   * Extract factual information from input
   */
  private async extractFacts(input: string): Promise<string[]> {
    const { object } = await generateObject({
      model: openai('gpt-4'),
      prompt: `
        Extract factual information from this input. Focus on:
        - Personal preferences and characteristics
        - Plans, goals, and activities
        - Key information about the user
        - Clear, actionable facts
        
        Input: ${input}
        
        Return as JSON array of facts.
      `,
      schema: z.object({
        facts: z.array(z.string()),
      }),
    });

    return object.facts;
  }

  /**
   * Find similar existing memories for each fact
   */
  private async findSimilarMemories(facts: string[], userId: string): Promise<Memory[]> {
    const allMemories: Memory[] = [];

    for (const fact of facts) {
      const embedding = await this.storage.embedQuery(fact);
      const similarMemories = await this.storage.searchMemories({
        userId,
        vector: embedding,
        limit: 5,
        threshold: 0.5,
      });
      allMemories.push(...similarMemories);
    }

    // Remove duplicates
    return allMemories.filter((memory, index, self) =>
      index === self.findIndex((m) => m.id === memory.id)
    );
  }

  /**
   * Generate consolidation actions for memory management
   */
  private async generateConsolidationActions(
    oldMemories: Memory[],
    newFacts: string[]
  ): Promise<MemoryAction[]> {
    const formattedMemories = oldMemories.map((memory) => ({
      id: memory.id,
      text: memory.content,
    }));

    const { object } = await generateObject({
      model: openai('gpt-4'),
      prompt: `
        Compare new facts with existing memories and determine actions:
        
        Existing Memories: ${JSON.stringify(formattedMemories)}
        New Facts: ${JSON.stringify(newFacts)}
        
        For each fact, determine if it should be:
        - ADD: Completely new information
        - UPDATE: Similar to existing but with new/changed info
        - DELETE: No longer relevant
        - UNCHANGED: Same information
        
        Return actions as JSON array.
      `,
      schema: z.object({
        actions: z.array(z.object({
          type: z.enum(['ADD', 'UPDATE', 'DELETE', 'UNCHANGED']),
          id: z.string().optional(),
          text: z.string(),
          oldFact: z.string().optional(),
        })),
      }),
    });

    return object.actions;
  }

  /**
   * Apply memory consolidation actions
   */
  private async applyMemoryActions(
    actions: MemoryAction[],
    factEmbeddings: Map<string, number[]>,
    context: MemoryMetadata
  ): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'ADD':
          await this.storage.addMemory({
            vector: factEmbeddings.get(action.text),
            content: action.text,
            metadata: {
              userId: context.userId,
              timestamp: Date.now(),
            },
          });
          break;

        case 'UPDATE':
          if (action.id) {
            await this.storage.updateMemory(action.id, {
              content: action.text,
            });
          }
          break;

        case 'DELETE':
          if (action.id) {
            await this.storage.deleteMemory(action.id);
          }
          break;

        case 'UNCHANGED':
          // No action needed
          break;
      }
    }
  }
}

// Usage Example
export async function createAgenticMemory() {
  // Create storage with default configuration
  const storage = createMemoryStorage(defaultStorageConfig);
  await storage.initialize();

  const memory = new AgenticMemory(storage);

  // Add information to memory
  await memory.add(
    "I'm a software engineer at Google and I prefer TypeScript for development",
    { userId: "user123", timestamp: Date.now() }
  );

  // Search for relevant memories
  const results = await memory.search(
    "What programming languages do I know?",
    { userId: "user123", timestamp: Date.now() }
  );

  console.log(results);

  return memory;
}

// Example usage with custom configuration
export async function createCustomAgenticMemory() {
  const customConfig = {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: 'custom_memory',
    embeddingSize: 1536,
    distanceMetric: 'Cosine' as const,
  };

  const storage = createMemoryStorage(customConfig);
  await storage.initialize();

  return new AgenticMemory(storage);
} 