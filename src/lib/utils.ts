/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/* c8 ignore next 3 -- @preserve */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
