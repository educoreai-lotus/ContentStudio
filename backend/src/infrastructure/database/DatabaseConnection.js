import pg from 'pg';
import dns from 'dns/promises';
import net from 'net';
const { Pool } = pg;

/**
 * PostgreSQL Database Connection
 * Singleton pattern for database connection pool
 */
export class DatabaseConnection {
  constructor() {
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn('DATABASE_URL not set, using in-memory repositories');
      this.pool = null;
      this.ready = Promise.resolve();
      DatabaseConnection.instance = this;
      return this;
    }

    this.pool = null;
    this.ready = this.initializePool(connectionString);
    DatabaseConnection.instance = this;
  }

  async initializePool(connectionString) {
    try {
      const url = new URL(connectionString);
      const config = {
        host: url.hostname,
        port: Number(url.port) || 5432,
        user: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
        database: (url.pathname || '').replace(/^\//, '') || undefined,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };

      const forcedHost = process.env.DATABASE_IPV4_HOST || process.env.PGHOSTADDR;
      if (forcedHost) {
        config.host = forcedHost;
        console.log(`Using forced database host from env: ${forcedHost}`);
      } else if (!net.isIP(config.host)) {
        try {
          const { address } = await dns.lookup(config.host, { family: 4 });
          if (address) {
            console.log(`Resolved database host to IPv4: ${address}`);
            config.host = address;
          }
        } catch (error) {
          console.warn(
            `Failed to resolve IPv4 for database host ${config.host}. Falling back to hostname.`,
            error.message
          );
        }
      }

      this.pool = new Pool(config);
      this.pool.on('error', err => {
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
      });
    } catch (error) {
      console.error('Failed to initialize database pool:', error);
      throw error;
    }
  }

  /**
   * Get database pool
   * @returns {Pool|null} Database pool or null if not configured
   */
  getPool() {
    return this.pool;
  }

  /**
   * Check if database is connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.pool !== null;
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    await this.ready;
    if (!this.pool) {
      return false;
    }

    try {
      const result = await this.pool.query('SELECT NOW()');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Execute a query
   * @param {string} text - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params) {
    await this.ready;
    if (!this.pool) {
      throw new Error('Database not configured. Set DATABASE_URL environment variable.');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    await this.ready;
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// Export singleton instance
export const db = new DatabaseConnection();



