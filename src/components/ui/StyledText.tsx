import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { twMerge } from 'tailwind-merge'; // We'll need tailwind-merge for robust class merging

// Extend RN TextProps to accept className
export interface TextProps extends RNTextProps {
  className?: string;
}

/**
 * A custom Text component that applies default styling (like font-sans)
 * and merges incoming classNames.
 */
export function Text({ className, style, ...props }: TextProps) {
  // Define default styles
  const defaultClassName = 'font-sans text-base text-black'; // Adjust default color/size as needed
  
  // Merge default and incoming classNames
  // twMerge handles conflicts and redundancy gracefully
  const mergedClassName = twMerge(defaultClassName, className);

  return <RNText className={mergedClassName} style={style} {...props} />;
} 