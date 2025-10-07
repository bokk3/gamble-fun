import mysql from 'mysql2/promise';

let connection: mysql.Connection;

export const connectDatabase = async (): Promise<void> => {
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'casino_user',
      password: process.env.DB_PASSWORD || 'casino_pass',
      database: process.env.DB_NAME || 'casino_db',
      timezone: '+00:00'
    });

    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const getConnection = (): mysql.Connection => {
  if (!connection) {
    throw new Error('Database not connected');
  }
  return connection;
};

export const executeQuery = async (
  query: string,
  params: any[] = []
): Promise<any> => {
  try {
    const [results] = await connection.execute(query, params);
    return results;
  } catch (error) {
    console.error('Query execution error:', error);
    throw error;
  }
};

export const executeTransaction = async (
  queries: Array<{ query: string; params: any[] }>
): Promise<any[]> => {
  await connection.beginTransaction();
  
  try {
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
};