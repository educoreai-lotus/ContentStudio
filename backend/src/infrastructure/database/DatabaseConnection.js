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
    this.ready = this.initializePool(connectionString).catch(err => {
      console.error('⚠️ Database initialization failed, server will run without database:', err.message);
      this.pool = null;
    });
    DatabaseConnection.instance = this;
  }

  async initializePool(connectionString) {
    try {
      const url = new URL(connectionString);
      let resolvedHost = url.hostname;

      // ✅ ALWAYS force IPv4 resolution if host is a domain (not a literal IP)
      if (!net.isIP(resolvedHost)) {
        let resolved = false;
        
        // Try using DNS resolve (more reliable than lookup in some environments)
        try {
          const addresses = await dns.resolve4(resolvedHost);
          if (addresses && addresses.length > 0) {
            console.log(`✅ Resolved ${resolvedHost} to IPv4: ${addresses[0]}`);
            resolvedHost = addresses[0];
            resolved = true;
          }
        } catch (error) {
          console.warn(`⚠️ DNS resolve4 failed for ${resolvedHost}:`, error.message);
          
          // Fallback to lookup
          try {
            const { address } = await dns.lookup(resolvedHost, { family: 4 });
            if (address && net.isIPv4(address)) {
              console.log(`✅ Resolved ${resolvedHost} to IPv4 via lookup: ${address}`);
              resolvedHost = address;
              resolved = true;
            }
          } catch (lookupError) {
            console.warn(`⚠️ DNS lookup also failed for ${resolvedHost}:`, lookupError.message);
          }
        }
        
        if (!resolved) {
          console.error(`❌ Could not resolve ${resolvedHost} to IPv4 - connection will likely fail`);
          // Still try with hostname as last resort
        }
      }

      const config = {
        host: resolvedHost,
        port: Number(url.port) || 5432,
        user: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
        database: (url.pathname || '').replace(/^\//, '') || undefined,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };

      // Development-only override (for local testing)
      // NOTE: PGHOSTADDR is IGNORED in production to prevent IPv6 issues
      if (process.env.NODE_ENV === 'development') {
        const forcedHost = process.env.DATABASE_IPV4_HOST;
        if (forcedHost) {
          config.host = forcedHost;
          if (process.env.DATABASE_IPV4_PORT) {
            config.port = Number(process.env.DATABASE_IPV4_PORT);
          }
          console.log(`🔧 (DEV MODE) Using forced database host: ${forcedHost}`);
        }
      }

      console.log(`🔌 Connecting to database at ${config.host}:${config.port}`);

      this.pool = new Pool(config);
      this.pool.on('error', err => {
        console.error('⚠️ Unexpected database error on idle client:', err.message);
        // Don't exit - just log the error
      });

      // Test the connection immediately
      const client = await this.pool.connect();
      client.release();
      console.log('✅ Database connection pool initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database pool:', error.message);
      this.pool = null;
      // Don't throw - let the server start without database
      console.warn('⚠️ Server will continue without database connection');
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
   * Get a raw client for transactional operations
   * @returns {Promise<pg.PoolClient>}
   */
  async getClient() {
    await this.ready;
    if (!this.pool) {
      throw new Error('Database not configured. Set DATABASE_URL environment variable.');
    }

    return this.pool.connect();
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



