export interface DocFrontmatter {
  title: string;
  description: string;
  order?: number;
}

export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  order?: number;
}

export interface NavItem {
  title: string;
  href: string;
  items?: NavItem[];
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export interface NavigationConfig {
  docs: NavGroup[];
}

export interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export interface InlineComment {
  id: string;
  content: string;
}
