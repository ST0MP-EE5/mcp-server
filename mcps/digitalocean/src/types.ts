// DigitalOcean API Types

export interface Droplet {
  id: number;
  name: string;
  memory: number;
  vcpus: number;
  disk: number;
  locked: boolean;
  status: 'new' | 'active' | 'off' | 'archive';
  created_at: string;
  features: string[];
  backup_ids: number[];
  snapshot_ids: number[];
  image: Image;
  volume_ids: string[];
  size: Size;
  size_slug: string;
  networks: Networks;
  region: Region;
  tags: string[];
  vpc_uuid?: string;
}

export interface Image {
  id: number;
  name: string;
  distribution: string;
  slug: string | null;
  public: boolean;
  regions: string[];
  created_at: string;
  min_disk_size: number;
  type: 'snapshot' | 'backup' | 'custom';
  size_gigabytes: number;
  description: string;
  tags: string[];
  status: 'available' | 'pending' | 'deleted';
}

export interface Size {
  slug: string;
  memory: number;
  vcpus: number;
  disk: number;
  transfer: number;
  price_monthly: number;
  price_hourly: number;
  regions: string[];
  available: boolean;
  description: string;
}

export interface Region {
  name: string;
  slug: string;
  features: string[];
  available: boolean;
  sizes: string[];
}

export interface Networks {
  v4: NetworkV4[];
  v6: NetworkV6[];
}

export interface NetworkV4 {
  ip_address: string;
  netmask: string;
  gateway: string;
  type: 'public' | 'private';
}

export interface NetworkV6 {
  ip_address: string;
  netmask: number;
  gateway: string;
  type: 'public' | 'private';
}

export interface CreateDropletParams {
  name: string;
  region: string;
  size: string;
  image: string | number;
  ssh_keys?: (string | number)[];
  backups?: boolean;
  ipv6?: boolean;
  monitoring?: boolean;
  tags?: string[];
  user_data?: string;
  vpc_uuid?: string;
}

export interface App {
  id: string;
  owner_uuid: string;
  spec: AppSpec;
  default_ingress: string;
  created_at: string;
  updated_at: string;
  active_deployment?: Deployment;
  in_progress_deployment?: Deployment;
  last_deployment_created_at?: string;
  live_url: string;
  live_url_base: string;
  live_domain: string;
  region: { slug: string; label: string; flag: string };
  tier_slug: string;
  project_id: string;
}

export interface AppSpec {
  name: string;
  region?: string;
  services?: ServiceSpec[];
  workers?: WorkerSpec[];
  jobs?: JobSpec[];
  databases?: DatabaseSpec[];
  static_sites?: StaticSiteSpec[];
}

export interface ServiceSpec {
  name: string;
  git?: GitSource;
  github?: GitHubSource;
  image?: ImageSource;
  dockerfile_path?: string;
  build_command?: string;
  run_command?: string;
  instance_count?: number;
  instance_size_slug?: string;
  http_port?: number;
  envs?: EnvVar[];
}

export interface WorkerSpec extends Omit<ServiceSpec, 'http_port'> {}

export interface JobSpec extends Omit<ServiceSpec, 'http_port' | 'instance_count'> {
  kind: 'PRE_DEPLOY' | 'POST_DEPLOY' | 'FAILED_DEPLOY';
}

export interface DatabaseSpec {
  name: string;
  engine: 'PG' | 'MYSQL' | 'REDIS' | 'MONGODB';
  version?: string;
  size?: string;
  num_nodes?: number;
  production?: boolean;
}

export interface StaticSiteSpec {
  name: string;
  git?: GitSource;
  github?: GitHubSource;
  build_command?: string;
  output_dir?: string;
  index_document?: string;
  error_document?: string;
  envs?: EnvVar[];
}

export interface GitSource {
  repo_clone_url: string;
  branch: string;
}

export interface GitHubSource {
  repo: string;
  branch: string;
  deploy_on_push?: boolean;
}

export interface ImageSource {
  registry_type: 'DOCR' | 'DOCKER_HUB' | 'GHCR';
  registry?: string;
  repository: string;
  tag?: string;
}

export interface EnvVar {
  key: string;
  value?: string;
  scope?: 'RUN_TIME' | 'BUILD_TIME' | 'RUN_AND_BUILD_TIME';
  type?: 'GENERAL' | 'SECRET';
}

export interface Deployment {
  id: string;
  spec: AppSpec;
  services?: DeploymentService[];
  static_sites?: DeploymentStaticSite[];
  workers?: DeploymentWorker[];
  jobs?: DeploymentJob[];
  phase: 'UNKNOWN' | 'PENDING_BUILD' | 'BUILDING' | 'PENDING_DEPLOY' | 'DEPLOYING' | 'ACTIVE' | 'SUPERSEDED' | 'ERROR' | 'CANCELED';
  phase_last_updated_at: string;
  created_at: string;
  updated_at: string;
  cause: string;
  progress: DeploymentProgress;
}

export interface DeploymentService {
  name: string;
  source_commit_hash?: string;
}

export interface DeploymentStaticSite {
  name: string;
  source_commit_hash?: string;
}

export interface DeploymentWorker {
  name: string;
  source_commit_hash?: string;
}

export interface DeploymentJob {
  name: string;
  source_commit_hash?: string;
}

export interface DeploymentProgress {
  pending_steps: number;
  running_steps: number;
  success_steps: number;
  error_steps: number;
  total_steps: number;
  steps: DeploymentStep[];
}

export interface DeploymentStep {
  name: string;
  status: 'UNKNOWN' | 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR';
  started_at?: string;
  ended_at?: string;
}

export interface Database {
  id: string;
  name: string;
  engine: 'pg' | 'mysql' | 'redis' | 'mongodb';
  version: string;
  num_nodes: number;
  size: string;
  region: string;
  status: 'creating' | 'online' | 'resizing' | 'migrating' | 'forking';
  created_at: string;
  connection: DatabaseConnection;
  private_connection?: DatabaseConnection;
  users: DatabaseUser[];
  db_names: string[];
  maintenance_window?: MaintenanceWindow;
  tags: string[];
}

export interface DatabaseConnection {
  protocol: string;
  uri: string;
  database: string;
  host: string;
  port: number;
  user: string;
  password: string;
  ssl: boolean;
}

export interface DatabaseUser {
  name: string;
  role: 'primary' | 'normal';
  password?: string;
}

export interface MaintenanceWindow {
  day: string;
  hour: string;
  pending: boolean;
  description: string[];
}

export interface CreateDatabaseParams {
  name: string;
  engine: 'pg' | 'mysql' | 'redis' | 'mongodb';
  version?: string;
  size: string;
  region: string;
  num_nodes?: number;
  tags?: string[];
  private_network_uuid?: string;
}

export interface Domain {
  name: string;
  ttl: number;
  zone_file: string;
}

export interface DomainRecord {
  id: number;
  type: 'A' | 'AAAA' | 'CAA' | 'CNAME' | 'MX' | 'NS' | 'SOA' | 'SRV' | 'TXT';
  name: string;
  data: string;
  priority?: number;
  port?: number;
  ttl: number;
  weight?: number;
  flags?: number;
  tag?: string;
}

export interface CreateRecordParams {
  type: DomainRecord['type'];
  name: string;
  data: string;
  priority?: number;
  port?: number;
  ttl?: number;
  weight?: number;
  flags?: number;
  tag?: string;
}

export interface Space {
  name: string;
  region: string;
}

export interface SpaceObject {
  key: string;
  last_modified: string;
  etag: string;
  size: number;
  storage_class: string;
}

export interface Account {
  droplet_limit: number;
  floating_ip_limit: number;
  volume_limit: number;
  email: string;
  uuid: string;
  email_verified: boolean;
  status: 'active' | 'warning' | 'locked';
  status_message: string;
  team?: Team;
}

export interface Team {
  uuid: string;
  name: string;
}

export interface Balance {
  month_to_date_balance: string;
  account_balance: string;
  month_to_date_usage: string;
  generated_at: string;
}

// Tool safety levels
export type SafetyLevel = 'read' | 'write' | 'destructive';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  safety: SafetyLevel;
}
