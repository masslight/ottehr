/**
 * config-types
 *
 * Core type definitions that define the contract between the Ottehr core system
 * and swappable configuration implementations.
 *
 * This package sits at the bottom of the dependency graph:
 * - config-types (this package) - defines the contracts
 * - utils, ottehr-config - implement/use the contracts
 * - apps - consume via utils
 *
 * When ottehr-config is swizzled out with instance-specific implementations,
 * these types remain stable and enforce that any replacement satisfies the contract.
 */

export * from './config';
