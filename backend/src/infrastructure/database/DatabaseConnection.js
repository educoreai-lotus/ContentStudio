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
      let resolvedHost = url.hostname;

      // ✅ ALWAYS force IPv4 resolution if host is a domain (not a literal IP)
      if (!net.isIP(resolvedHost)) {
        let resolved = false;
        // Try multiple times with different DNS servers
        const dnsAttempts = [
          { family: 4 },
          { family: 4, hints: dns.ADDRCONFIG },
        ];
        
        for (const options of dnsAttempts) {
          try {
            const { address } = await dns.lookup(resolvedHost, options);
            if (address && net.isIPv4(address)) {
              console.log(`✅ Resolved ${resolvedHost} to IPv4: ${address}`);
              resolvedHost = address;
              resolved = true;
              break;
            }
          } catch (error) {
            console.warn(`⚠️ DNS lookup attempt failed for ${resolvedHost}:`, error.message);
          }
        }
        
        if (!resolved) {
          console.warn(`⚠️ Could not resolve IPv4 for ${resolvedHost}, using hostname (may cause IPv6 issues)`);
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
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
      });

      // Test the connection immediately
      const client = await this.pool.connect();
      client.release();
      console.log('✅ Database connection pool initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database pool:', error);
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



