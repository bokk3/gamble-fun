import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient>;

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not connected');
  }
  return redisClient;
};

export const setCache = async (key: string, value: any, ttl = 3600): Promise<void> => {
  await redisClient.setEx(key, ttl, JSON.stringify(value));
};

export const getCache = async (key: string): Promise<any | null> => {
  const value = await redisClient.get(key);
  return value ? JSON.parse(value) : null;
};

export const deleteCache = async (key: string): Promise<void> => {
  await redisClient.del(key);
};