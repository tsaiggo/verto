/** Configuration for table of contents extraction */
export interface TocConfig {
  /** Minimum heading depth to include (default: 2) */
  minDepth?: number;
  /** Maximum heading depth to include (default: 3) */
  maxDepth?: number;
}

export interface TOCItem {
  id: string;
  text: string;
  level: number;
}
