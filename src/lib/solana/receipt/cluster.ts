import { Connection, clusterApiUrl } from '@solana/web3.js'

/** Supported cluster identifiers. */
export type ClusterName = 'mainnet-beta' | 'devnet' | 'testnet'

/** The Memo program deployed on all Solana clusters. */
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

/** Mainnet RPC endpoints (for analysis). */
const MAINNET_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
]

/** Devnet RPC endpoints (for receipt publication). */
const DEVNET_ENDPOINTS = [
  'https://api.devnet.solana.com',
]

/** Testnet RPC endpoints. */
const TESTNET_ENDPOINTS = [
  'https://api.testnet.solana.com',
]

function endpointsForCluster(cluster: ClusterName): string[] {
  switch (cluster) {
    case 'mainnet-beta': return MAINNET_ENDPOINTS
    case 'devnet': return DEVNET_ENDPOINTS
    case 'testnet': return TESTNET_ENDPOINTS
  }
}

const connections = new Map<ClusterName, Connection>()

/**
 * Get a Connection for the specified cluster.
 * Reuses connections within a session.
 */
export function getClusterConnection(cluster: ClusterName): Connection {
  let conn = connections.get(cluster)
  if (!conn) {
    const endpoints = endpointsForCluster(cluster)
    conn = new Connection(endpoints[0], 'confirmed')
    connections.set(cluster, conn)
  }
  return conn
}

/**
 * Get the cluster's API URL for display and explorer links.
 */
export function clusterApiUrlFor(cluster: ClusterName): string {
  return clusterApiUrl(cluster)
}

/**
 * Build a Solana Explorer URL for a transaction signature.
 */
export function explorerTxUrl(signature: string, cluster: ClusterName): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`
}

/**
 * Build a Solana Explorer URL for an address.
 */
export function explorerAddressUrl(address: string, cluster: ClusterName): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`
}

/**
 * Get human-readable label for a cluster.
 */
export function clusterLabel(cluster: ClusterName): string {
  switch (cluster) {
    case 'mainnet-beta': return 'Mainnet'
    case 'devnet': return 'Devnet'
    case 'testnet': return 'Testnet'
  }
}

/**
 * Validate that an RPC endpoint is actually serving the expected cluster.
 * Returns the cluster name if valid, null if mismatch or unreachable.
 */
export async function validateCluster(
  cluster: ClusterName,
): Promise<ClusterName | null> {
  try {
    const conn = getClusterConnection(cluster)
    const version = await conn.getVersion()
    if (version?.['solana-core']) {
      return cluster
    }
    return null
  } catch {
    return null
  }
}
