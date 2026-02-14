export interface Rule {
  folderName: string;
  extensions: string[];
}

export interface AppConfig {
  rules: Rule[];
  defaultFolder: string;
}
