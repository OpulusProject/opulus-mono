/** A short, colored status shown beside a row's text, e.g. "Overdue". */
export interface Notice {
  text: string;
  tone: 'danger' | 'muted' | 'warning';
}
