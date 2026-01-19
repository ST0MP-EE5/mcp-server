import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Droplet,
  CreateDropletParams,
  App,
  AppSpec,
  Database,
  CreateDatabaseParams,
  Domain,
  DomainRecord,
  CreateRecordParams,
  Account,
  Balance,
  Region,
  Size,
  Image
} from './types.js';

const DO_API_BASE = 'https://api.digitalocean.com/v2';

export interface DOClientConfig {
  apiToken: string;
  timeout?: number;
}

export class DOClient {
  private client: AxiosInstance;

  constructor(config: DOClientConfig) {
    this.client = axios.create({
      baseURL: DO_API_BASE,
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  private handleError(error: unknown): never {
    if (error instanceof AxiosError) {
      const message = error.response?.data?.message || error.message;
      const id = error.response?.data?.id;
      throw new Error(`DigitalOcean API Error: ${message}${id ? ` (${id})` : ''}`);
    }
    throw error;
  }

  // ============ Account ============

  async getAccount(): Promise<Account> {
    try {
      const response = await this.client.get('/account');
      return response.data.account;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getBalance(): Promise<Balance> {
    try {
      const response = await this.client.get('/customers/my/balance');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============ Droplets ============

  async listDroplets(params?: { tag_name?: string; per_page?: number; page?: number }): Promise<Droplet[]> {
    try {
      const response = await this.client.get('/droplets', { params });
      return response.data.droplets;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getDroplet(id: number): Promise<Droplet> {
    try {
      const response = await this.client.get(`/droplets/${id}`);
      return response.data.droplet;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createDroplet(params: CreateDropletParams): Promise<Droplet> {
    try {
      const response = await this.client.post('/droplets', params);
      return response.data.droplet;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteDroplet(id: number): Promise<void> {
    try {
      await this.client.delete(`/droplets/${id}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  async performDropletAction(id: number, action: {
    type: 'reboot' | 'power_cycle' | 'shutdown' | 'power_off' | 'power_on' | 'rebuild' | 'resize' | 'snapshot';
    image?: string | number;
    size?: string;
    name?: string;
  }): Promise<{ action: { id: number; status: string; type: string } }> {
    try {
      const response = await this.client.post(`/droplets/${id}/actions`, action);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============ Regions & Sizes ============

  async listRegions(): Promise<Region[]> {
    try {
      const response = await this.client.get('/regions');
      return response.data.regions;
    } catch (error) {
      this.handleError(error);
    }
  }

  async listSizes(): Promise<Size[]> {
    try {
      const response = await this.client.get('/sizes');
      return response.data.sizes;
    } catch (error) {
      this.handleError(error);
    }
  }

  async listImages(params?: { type?: 'distribution' | 'application'; private?: boolean }): Promise<Image[]> {
    try {
      const response = await this.client.get('/images', { params });
      return response.data.images;
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============ Apps ============

  async listApps(): Promise<App[]> {
    try {
      const response = await this.client.get('/apps');
      return response.data.apps || [];
    } catch (error) {
      this.handleError(error);
    }
  }

  async getApp(id: string): Promise<App> {
    try {
      const response = await this.client.get(`/apps/${id}`);
      return response.data.app;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createApp(spec: AppSpec): Promise<App> {
    try {
      const response = await this.client.post('/apps', { spec });
      return response.data.app;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateApp(id: string, spec: AppSpec): Promise<App> {
    try {
      const response = await this.client.put(`/apps/${id}`, { spec });
      return response.data.app;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteApp(id: string): Promise<void> {
    try {
      await this.client.delete(`/apps/${id}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  async getAppLogs(id: string, params?: {
    deployment_id?: string;
    component_name?: string;
    type?: 'BUILD' | 'DEPLOY' | 'RUN';
    follow?: boolean;
  }): Promise<{ live_url: string; historic_urls?: string[] }> {
    try {
      const response = await this.client.get(`/apps/${id}/logs`, { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async restartApp(id: string): Promise<{ deployment: { id: string } }> {
    try {
      const response = await this.client.post(`/apps/${id}/deployments`, {});
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============ Databases ============

  async listDatabases(): Promise<Database[]> {
    try {
      const response = await this.client.get('/databases');
      return response.data.databases || [];
    } catch (error) {
      this.handleError(error);
    }
  }

  async getDatabase(id: string): Promise<Database> {
    try {
      const response = await this.client.get(`/databases/${id}`);
      return response.data.database;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createDatabase(params: CreateDatabaseParams): Promise<Database> {
    try {
      const response = await this.client.post('/databases', params);
      return response.data.database;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteDatabase(id: string): Promise<void> {
    try {
      await this.client.delete(`/databases/${id}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============ Domains ============

  async listDomains(): Promise<Domain[]> {
    try {
      const response = await this.client.get('/domains');
      return response.data.domains || [];
    } catch (error) {
      this.handleError(error);
    }
  }

  async getDomain(name: string): Promise<Domain> {
    try {
      const response = await this.client.get(`/domains/${name}`);
      return response.data.domain;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createDomain(name: string, ipAddress?: string): Promise<Domain> {
    try {
      const response = await this.client.post('/domains', {
        name,
        ip_address: ipAddress
      });
      return response.data.domain;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteDomain(name: string): Promise<void> {
    try {
      await this.client.delete(`/domains/${name}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  async listDomainRecords(domain: string): Promise<DomainRecord[]> {
    try {
      const response = await this.client.get(`/domains/${domain}/records`);
      return response.data.domain_records || [];
    } catch (error) {
      this.handleError(error);
    }
  }

  async createDomainRecord(domain: string, params: CreateRecordParams): Promise<DomainRecord> {
    try {
      const response = await this.client.post(`/domains/${domain}/records`, params);
      return response.data.domain_record;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteDomainRecord(domain: string, recordId: number): Promise<void> {
    try {
      await this.client.delete(`/domains/${domain}/records/${recordId}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============ SSH Keys ============

  async listSSHKeys(): Promise<Array<{ id: number; name: string; fingerprint: string; public_key: string }>> {
    try {
      const response = await this.client.get('/account/keys');
      return response.data.ssh_keys || [];
    } catch (error) {
      this.handleError(error);
    }
  }
}

// Singleton instance factory
let clientInstance: DOClient | null = null;

export function getClient(): DOClient {
  if (!clientInstance) {
    const apiToken = process.env.DO_API_TOKEN;
    if (!apiToken) {
      throw new Error('DO_API_TOKEN environment variable is required');
    }
    clientInstance = new DOClient({ apiToken });
  }
  return clientInstance;
}
