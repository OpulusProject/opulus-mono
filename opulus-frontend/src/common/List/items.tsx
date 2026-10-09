import * as React from 'react';

/**
 * Wrap each child in an `li`, so a list's parts are real list items without
 * every caller writing the `li`. Empty children (null, false) are skipped.
 * Children go in as elements or arrays of them, not inside a fragment.
 */
export function toListItems(children: React.ReactNode) {
  return React.Children.toArray(children).map((child, index) => (
    <li key={React.isValidElement(child) ? (child.key ?? index) : index}>
      {child}
    </li>
  ));
}
