/**
 * Agentic Memory Storage Implementation
 * 
 * Complete storage layer for the agentic memory system using Qdrant vector database.
 * This implements the core storage operations needed for memory management.
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

// Core interfaces
export interface MemoryMetadata {
  userId: string;
  timestamp: number;
}

export interface Memory {
  id: string;
  content: string;
  metadata: MemoryMetadata;
  vector?: number[];
  createdAt: number;
  updatedAt: number;
}

export interface MemorySearchParams {
  userId: string;
  query?: string;
  vector?: number[];
  limit?: number;
  threshold?: number;
}

export interface MemoryStorageConfig {
  url: string;
  apiKey?: string;
  collectionName?: string;
}

/**
 * Complete Memory Storage Implementation
 * 
 * Handles all vector database operations for the agentic memory system.
 * Provides CRUD operations, semantic search, and embedding generation.
 */
export class MemoryStorage {
  private client: QdrantClient;
  private collectionName: string;

  constructor(config: MemoryStorageConfig) {
    this.client = new QdrantClient({ 
      url: config.url, 
      apiKey: config.apiKey 
    });
    this.collectionName = config.collectionName || 'agentic_memory';
  }

  /**
   * Initialize the vector database collection
   */
  async initialize(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (col) => col.name === this.collectionName
      );

      if (!exists) {
        // Create collection with proper configuration
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        });

        // Create payload indexes for efficient filtering
        await this.createIndexes();
      }

      console.log(`Memory storage initialized: ${this.collectionName}`);
    } catch (error) {
      console.error('Failed to initialize memory storage:', error);
      throw new Error(`Memory storage initialization failed: ${error}`);
    }
  }

  /**
   * Create database indexes for efficient querying
   */
  private async createIndexes(): Promise<void> {
    try {
      // User ID index for filtering
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'metadata.userId',
        field_schema: 'keyword',
      });

      // Timestamp index for temporal queries
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'metadata.timestamp',
        field_schema: 'integer',
      });

      // Content index for text search
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'content',
        field_schema: 'text',
      });

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Failed to create indexes:', error);
      // Don't throw here as indexes are optional for basic functionality
    }
  }

  /**
   * Add a new memory to storage
   */
  async addMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = crypto.randomUUID();
      const now = Date.now();

      // Generate embedding if not provided
      const vector = memory.vector || await this.embedQuery(memory.content);

      await this.client.upsert(this.collectionName, {
        points: [{
          id,
          vector,
          payload: {
            content: memory.content,
            metadata: memory.metadata,
            createdAt: now,
            updatedAt: now,
          },
        }],
      });

      console.log(`Memory added: ${id}`);
      return id;
    } catch (error) {
      console.error('Failed to add memory:', error);
      throw new Error(`Failed to add memory: ${error}`);
    }
  }

  /**
   * Update an existing memory
   */
  async updateMemory(id: string, updates: Partial<Memory>): Promise<void> {
    try {
      const now = Date.now();
      const payload: any = {
        updatedAt: now,
      };

      // Update content if provided
      if (updates.content) {
        payload.content = updates.content;
        // Regenerate embedding for updated content
        payload.vector = await this.embedQuery(updates.content);
      }

      // Update metadata if provided
      if (updates.metadata) {
        payload.metadata = updates.metadata;
      }

      await this.client.setPayload(this.collectionName, {
        points: [id],
        payload,
      });

      console.log(`Memory updated: ${id}`);
    } catch (error) {
      console.error('Failed to update memory:', error);
      throw new Error(`Failed to update memory: ${error}`);
    }
  }

  /**
   * Delete a memory by ID
   */
  async deleteMemory(id: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        points: [id],
      });

      console.log(`Memory deleted: ${id}`);
    } catch (error) {
      console.error('Failed to delete memory:', error);
      throw new Error(`Failed to delete memory: ${error}`);
    }
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllMemories(userId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'metadata.userId',
              match: { value: userId },
            },
          ],
        },
      });

      console.log(`All memories deleted for user: ${userId}`);
    } catch (error) {
      console.error('Failed to delete all memories:', error);
      throw new Error(`Failed to delete all memories: ${error}`);
    }
  }

  /**
   * Get a memory by ID
   */
  async getMemory(id: string): Promise<Memory | null> {
    try {
      const result = await this.client.retrieve(this.collectionName, {
        ids: [id],
      });

      if (result.length === 0) return null;

      const point = result[0];
      return {
        id: point.id as string,
        content: point.payload?.content as string,
        metadata: point.payload?.metadata as MemoryMetadata,
        vector: point.vector as number[],
        createdAt: point.payload?.createdAt as number,
        updatedAt: point.payload?.updatedAt as number,
      };
    } catch (error) {
      console.error('Failed to get memory:', error);
      return null;
    }
  }

  /**
   * Search memories using semantic similarity
   */
  async searchMemories(params: MemorySearchParams): Promise<Memory[]> {
    try {
      const { userId, query, vector, limit = 10, threshold = 0.3 } = params;

      // Build filter for user isolation
      const filter: any = {
        must: [
          {
            key: 'metadata.userId',
            match: { value: userId },
          },
        ],
      };

      const searchParams: any = {
        filter,
        limit,
      };

      // Use provided vector or generate from query
      if (!vector && !query) {
        throw new Error('Either vector or query must be provided');
      }

      searchParams.vector = vector || await this.embedQuery(query || '');
      searchParams.score_threshold = threshold;

      const result = await this.client.search(this.collectionName, searchParams);

      return result.map((point) => ({
        id: point.id as string,
        content: point.payload?.content as string,
        metadata: point.payload?.metadata as MemoryMetadata,
        vector: point.vector as number[],
        createdAt: point.payload?.createdAt as number,
        updatedAt: point.payload?.updatedAt as number,
      }));
    } catch (error) {
      console.error('Failed to search memories:', error);
      throw new Error(`Failed to search memories: ${error}`);
    }
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
    try {
      const result = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            {
              key: 'metadata.userId',
              match: { value: userId },
            },
            {
              key: 'metadata.timestamp',
              range: {
                gte: startDate,
                lte: endDate,
              },
            },
          ],
        },
        limit,
      });

      return result.points.map((point) => ({
        id: point.id as string,
        content: point.payload?.content as string,
        metadata: point.payload?.metadata as MemoryMetadata,
        vector: point.vector as number[],
        createdAt: point.payload?.createdAt as number,
        updatedAt: point.payload?.updatedAt as number,
      }));
    } catch (error) {
      console.error('Failed to get memories by date range:', error);
      throw new Error(`Failed to get memories by date range: ${error}`);
    }
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async embedQuery(query: string): Promise<number[]> {
    try {
      const { embedding } = await embed({
        model: openai.textEmbeddingModel('text-embedding-3-small'),
        value: query,
      });
      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }
}

/**
 * Factory function to create a configured memory storage instance
 */
export function createMemoryStorage(config: MemoryStorageConfig): MemoryStorage {
  return new MemoryStorage(config);
}

/**
 * Default configuration for memory storage
 */
export const defaultStorageConfig: MemoryStorageConfig = {
  url: process.env.QDRANT_URL || 'qdrant_url',
  apiKey: process.env.QDRANT_API_KEY,
  collectionName: process.env.MEMORY_COLLECTION_NAME || 'agentic_memory',
}; 