# Blob Storage Optimization - Cache Implementation

## Overview

Implemented in-memory caching with TTL (Time-To-Live) to dramatically reduce Vercel Blob Storage API calls.

## How It Works

### Cache Configuration

- **TTL (Time-To-Live)**: 5 minutes by default
- **Configurable**: Set `CACHE_TTL` environment variable (in milliseconds)
- **Scope**: Per serverless function instance

### Caching Strategy

1. **Read Operations**: Check cache first, only fetch from blob if cache miss or expired
2. **Write Operations**: Invalidate cache immediately to ensure consistency
3. **Cache Keys**: Separate caches for `productos`, `ventas`, `servicios`, `horarios`

### Expected Performance Improvement

- **Before**: Every API call = 1 blob read
- **After**: Multiple API calls within 5 minutes = 1 blob read (first request only)
- **Reduction**: 80-95% fewer blob reads (depending on traffic patterns)

## Example Scenarios

### Scenario 1: High Traffic Public Site

- 100 visitors in 5 minutes viewing products
- **Without cache**: 100 blob reads
- **With cache**: 1 blob read (99% reduction)

### Scenario 2: Admin Making Updates

- Admin edits a product
- Cache is invalidated
- Next visitor triggers a fresh blob read
- Cache is rebuilt automatically

### Scenario 3: Multiple Data Types

- Visitor loads homepage (productos, ventas, servicios, horarios)
- **Without cache**: 4 blob reads
- **With cache (warm)**: 0 blob reads
- **With cache (cold)**: 4 blob reads (then cached for 5 min)

## Monitoring Cache Performance

Watch your server logs for these indicators:

```
[CACHE HIT] productos - age: 45s
[CACHE SET] productos
[CACHE INVALIDATE] productos
```

## Adjusting Cache TTL

To change the cache duration, set the `CACHE_TTL` environment variable:

```bash
# 1 minute
CACHE_TTL=60000

# 10 minutes
CACHE_TTL=600000

# 30 minutes (aggressive caching)
CACHE_TTL=1800000
```

## Important Notes

1. **Serverless Limitation**: Each Vercel function instance has its own cache. Multiple concurrent instances won't share cache.
2. **Eventually Consistent**: In rare cases (multiple instances), users might see slightly stale data (max 5 minutes old).
3. **Write-Through**: All writes immediately invalidate cache, so updates are always fresh.
4. **Memory Usage**: Minimal - only stores JSON data in memory temporarily.

## Vercel Blob Pricing Impact

With typical traffic patterns, this should reduce blob operations by **80-95%**, significantly lowering costs on high-traffic sites.
