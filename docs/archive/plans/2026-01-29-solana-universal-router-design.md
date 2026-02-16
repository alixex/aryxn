# Solana Universal Router 设计方案

**日期**: 2026-01-29
**状态**: 📝 设计完成，待实施
**目标**: 构建极简、可扩展、低费用的全链上 Token 交换协议

---

## 执行摘要

### 核心定位

Solana Universal Router 是一个**极简高效**的全链上 Token 交换协议。通过集成主流 DEX（Jupiter/Raydium/Orca）提供最优价格，同时保持架构简单、费用低廉、完全去中心化。

### 关键差异化

- ✅ **完全链上**：零链下依赖，无单点故障
- ✅ **可扩展架构**：动态添加/删除/配置 Token
- ✅ **极低费用**：优化到 80-120k CU，协议费仅 0.04%
- ✅ **多 DEX 支持**：Jupiter 聚合 + Raydium AMM + Orca Whirlpool
- ✅ **安全稳定**：完善的权限控制和紧急机制

### 技术栈

- **程序框架**: Anchor 0.29+
- **DEX 集成**: Jupiter / Raydium / Orca CPI
- **价格验证**: Pyth Network (可选)
- **SDK**: TypeScript + React Hooks
- **安全**: 多签管理 + 紧急暂停

---

## 一、系统架构

### 1.1 极简全链上架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户界面层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Web dApp    │  │  移动应用     │  │  CLI 工具    │     │
│  │              │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    UniversalRouter 程序层                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    核心模块                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │ RouterState  │  │TokenRegistry │  │  Swap    │ │   │
│  │  │  (全局配置)  │  │ (Token白名单) │  │ (交换)   │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │   Security   │  │   Admin      │  │  Stats   │ │   │
│  │  │  (安全控制)  │  │ (管理功能)   │  │ (统计)   │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    DEX 集成层 (CPI)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Jupiter  │  │ Raydium  │  │   Orca   │  │  Pyth    │  │
│  │Aggregator│  │   AMM    │  │Whirlpool │  │ (可选)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**架构特点**:

- 🎯 **零链下依赖** - 所有逻辑完全链上
- 🔄 **可扩展设计** - 支持动态添加 DEX 和 Token
- ⚡ **性能优化** - 最小化 CU 消耗
- 🔒 **安全第一** - 多层验证和保护机制

### 1.2 设计理念

| 原则         | 实现方式        | 优势           |
| ------------ | --------------- | -------------- |
| **简单性**   | 仅核心交换功能  | 易审计、低风险 |
| **可扩展**   | 动态 Token 配置 | 无需升级程序   |
| **低成本**   | CU 优化         | 用户费用最低   |
| **去中心化** | 全链上架构      | 无单点故障     |
| **互操作性** | 多 DEX 支持     | 最优价格路由   |

---

## 二、核心数据结构

### 2.1 全局路由器状态

```rust
#[account]
#[derive(InitSpace)]
pub struct RouterState {
    /// 管理员地址（推荐使用多签钱包）
    pub authority: Pubkey,          // 32 bytes

    /// 费用接收地址
    pub fee_recipient: Pubkey,      // 32 bytes

    /// 默认协议费率（基点 bps，1 bps = 0.01%）
    pub default_fee_bps: u16,       // 2 bytes (例如 4 = 0.04%)

    /// 支持的 token 总数
    pub total_tokens: u16,          // 2 bytes

    /// 全局交易量统计 (USD)
    pub total_volume_usd: u64,      // 8 bytes

    /// 紧急暂停开关
    pub paused: bool,               // 1 byte

    /// 程序版本号
    pub version: u8,                // 1 byte

    /// PDA bump
    pub bump: u8,                   // 1 byte
}
// 总空间：8 (discriminator) + 79 = 87 bytes
```

### 2.2 Token 配置账户

```rust
#[account]
#[derive(InitSpace)]
pub struct TokenConfig {
    /// Token Mint 地址
    pub mint: Pubkey,               // 32 bytes

    /// 是否启用该 Token
    pub enabled: bool,              // 1 byte

    /// 自定义费率（0 = 使用默认费率）
    pub custom_fee_bps: u16,        // 2 bytes

    /// Pyth 价格 Feed 地址（可选，用于统计和验证）
    pub pyth_price_feed: Option<Pubkey>,  // 33 bytes (1 + 32)

    /// 累计交易量
    pub volume: u64,                // 8 bytes

    /// 累计费用收入
    pub fees_collected: u64,        // 8 bytes

    /// 最后更新时间戳
    pub last_updated: i64,          // 8 bytes

    /// PDA bump
    pub bump: u8,                   // 1 byte
}
// 总空间：8 (discriminator) + 93 = 101 bytes
```

### 2.3 DEX 配置账户（动态 DEX 注册）

**设计目标**: 允许管理员动态添加/删除/配置 DEX，无需升级程序

```rust
#[account]
#[derive(InitSpace)]
pub struct DexConfig {
    /// DEX 唯一标识符（例如 "jupiter", "raydium", "orca"）
    #[max_len(32)]
    pub dex_id: String,             // 4 + 32 = 36 bytes

    /// DEX 程序 ID
    pub program_id: Pubkey,         // 32 bytes

    /// 是否启用该 DEX
    pub enabled: bool,              // 1 byte

    /// DEX 类型（用于集成逻辑）
    pub dex_type: DexType,          // 1 byte

    /// 通过该 DEX 执行的总交换次数
    pub total_swaps: u64,           // 8 bytes

    /// 通过该 DEX 路由的总交易量
    pub total_volume: u64,          // 8 bytes

    /// 最后更新时间戳
    pub last_updated: i64,          // 8 bytes

    /// PDA bump
    pub bump: u8,                   // 1 byte
}
// 总空间：8 (discriminator) + 95 = 103 bytes

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq)]
pub enum DexType {
    Jupiter,   // 聚合器（推荐）
    Raydium,   // AMM
    Orca,      // Whirlpool
    Phoenix,   // 订单簿
    Meteora,   // 动态池
    Custom,    // 自定义集成
}
```

**优势**:

- ✅ **动态扩展**: 管理员可以随时添加新 DEX
- ✅ **灵活控制**: 可以临时禁用某个 DEX
- ✅ **统计追踪**: 记录每个 DEX 的使用情况
- ✅ **降低耦合**: DEX 配置与核心逻辑分离

### 2.4 路由配置账户（可选功能 - 未来版本）

```rust
#[account]
#[derive(InitSpace)]
pub struct RouteConfig {
    /// 输入 Token
    pub token_in: Pubkey,           // 32 bytes

    /// 输出 Token
    pub token_out: Pubkey,          // 32 bytes

    /// 推荐的 DEX ID
    #[max_len(32)]
    pub preferred_dex_id: String,   // 4 + 32 = 36 bytes

    /// 最小交易金额
    pub min_swap_amount: u64,       // 8 bytes

    /// 最大交易金额（0 = 无限制）
    pub max_swap_amount: u64,       // 8 bytes

    /// 是否启用该路由
    pub enabled: bool,              // 1 byte

    /// PDA bump
    pub bump: u8,                   // 1 byte
}
// 总空间：8 (discriminator) + 118 = 126 bytes
```

### 2.5 PDA 种子设计

```rust
// 全局状态 PDA
seeds = [b"router_state"]
// 示例：7kXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

// Token 配置 PDA
seeds = [b"token_config", mint.key().as_ref()]
// 示例：8kYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY

// DEX 配置 PDA
seeds = [b"dex_config", dex_id.as_bytes()]
// 示例：9kZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ

// 路由配置 PDA（可选）
seeds = [b"route", token_in.key().as_ref(), token_out.key().as_ref()]
// 示例：AkWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW

// 费用金库（每个 Token 一个 ATA）
seeds = [b"fee_vault", mint.key().as_ref()]
```

---

## 三、核心功能实现

### 3.1 初始化路由器

**指令签名**:

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    default_fee_bps: u16,
) -> Result<()>
```

**实现**:

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    default_fee_bps: u16,
) -> Result<()> {
    // 验证费率不超过 1%
    require!(default_fee_bps <= 100, ErrorCode::FeeTooHigh);

    let state = &mut ctx.accounts.router_state;
    state.authority = ctx.accounts.authority.key();
    state.fee_recipient = ctx.accounts.fee_recipient.key();
    state.default_fee_bps = default_fee_bps;
    state.total_volume_usd = 0;
    state.total_tokens = 0;
    state.paused = false;
    state.version = 1;
    state.bump = ctx.bumps.router_state;

    msg!("✅ Router initialized with fee: {} bps", default_fee_bps);

    emit!(RouterInitialized {
        authority: state.authority,
        fee_bps: default_fee_bps,
    });

    Ok(())
}
```

### 3.2 Token 管理

#### 3.2.1 添加 Token

```rust
pub fn add_token(
    ctx: Context<AddToken>,
    custom_fee_bps: u16,
    pyth_price_feed: Option<Pubkey>,
) -> Result<()> {
    // 权限检查
    require!(
        ctx.accounts.router_state.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    // 验证费率
    require!(custom_fee_bps <= 100, ErrorCode::FeeTooHigh);

    let token_config = &mut ctx.accounts.token_config;
    token_config.mint = ctx.accounts.token_mint.key();
    token_config.enabled = true;
    token_config.custom_fee_bps = custom_fee_bps;
    token_config.pyth_price_feed = pyth_price_feed;
    token_config.volume = 0;
    token_config.fees_collected = 0;
    token_config.last_updated = Clock::get()?.unix_timestamp;
    token_config.bump = ctx.bumps.token_config;

    // 更新全局计数
    ctx.accounts.router_state.total_tokens = ctx.accounts.router_state
        .total_tokens
        .checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    emit!(TokenAdded {
        mint: token_config.mint,
        custom_fee_bps,
    });

    Ok(())
}
```

#### 3.2.2 启用/禁用 Token

```rust
pub fn toggle_token(
    ctx: Context<ToggleToken>,
    enabled: bool,
) -> Result<()> {
    require!(
        ctx.accounts.router_state.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    let token_config = &mut ctx.accounts.token_config;
    token_config.enabled = enabled;
    token_config.last_updated = Clock::get()?.unix_timestamp;

    emit!(TokenToggled {
        mint: token_config.mint,
        enabled,
    });

    Ok(())
}
```

#### 3.2.3 删除 Token（回收租金）

```rust
pub fn remove_token(ctx: Context<RemoveToken>) -> Result<()> {
    require!(
        ctx.accounts.router_state.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    ctx.accounts.router_state.total_tokens = ctx.accounts.router_state
        .total_tokens
        .checked_sub(1)
        .ok_or(ErrorCode::Underflow)?;

    emit!(TokenRemoved {
        mint: ctx.accounts.token_config.mint,
    });

    // 账户关闭，租金退还给 authority
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveToken<'info> {
    #[account(mut)]
    pub router_state: Account<'info, RouterState>,

    #[account(
        mut,
        close = authority,  // 关闭账户并退款
        seeds = [b"token_config", token_config.mint.as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
}
```

### 3.3 DEX 管理（动态 DEX 注册）

**设计亮点**: 管理员可以动态添加/删除/配置 DEX，无需升级程序

#### 3.3.1 添加 DEX

```rust
pub fn add_dex(
    ctx: Context<AddDex>,
    dex_id: String,
    program_id: Pubkey,
    dex_type: DexType,
) -> Result<()> {
    // 权限检查
    require!(
        ctx.accounts.router_state.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    // 验证 DEX ID 长度
    require!(dex_id.len() <= 32, ErrorCode::DexIdTooLong);

    let dex_config = &mut ctx.accounts.dex_config;
    dex_config.dex_id = dex_id.clone();
    dex_config.program_id = program_id;
    dex_config.enabled = true;
    dex_config.dex_type = dex_type;
    dex_config.total_swaps = 0;
    dex_config.total_volume = 0;
    dex_config.last_updated = Clock::get()?.unix_timestamp;
    dex_config.bump = ctx.bumps.dex_config;

    emit!(DexAdded {
        dex_id,
        program_id,
        dex_type,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(dex_id: String)]
pub struct AddDex<'info> {
    #[account(mut)]
    pub router_state: Account<'info, RouterState>,

    #[account(
        init,
        payer = authority,
        space = 8 + DexConfig::INIT_SPACE,
        seeds = [b"dex_config", dex_id.as_bytes()],
        bump
    )]
    pub dex_config: Account<'info, DexConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

#### 3.3.2 启用/禁用 DEX

```rust
pub fn toggle_dex(
    ctx: Context<ToggleDex>,
    enabled: bool,
) -> Result<()> {
    require!(
        ctx.accounts.router_state.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    let dex_config = &mut ctx.accounts.dex_config;
    dex_config.enabled = enabled;
    dex_config.last_updated = Clock::get()?.unix_timestamp;

    emit!(DexToggled {
        dex_id: dex_config.dex_id.clone(),
        enabled,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ToggleDex<'info> {
    #[account(mut)]
    pub router_state: Account<'info, RouterState>,

    #[account(
        mut,
        seeds = [b"dex_config", dex_config.dex_id.as_bytes()],
        bump = dex_config.bump
    )]
    pub dex_config: Account<'info, DexConfig>,

    pub authority: Signer<'info>,
}
```

#### 3.3.3 删除 DEX（回收租金）

```rust
pub fn remove_dex(ctx: Context<RemoveDex>) -> Result<()> {
    require!(
        ctx.accounts.router_state.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    emit!(DexRemoved {
        dex_id: ctx.accounts.dex_config.dex_id.clone(),
    });

    // 账户关闭，租金退还给 authority
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveDex<'info> {
    #[account(mut)]
    pub router_state: Account<'info, RouterState>,

    #[account(
        mut,
        close = authority,  // 关闭账户并退款
        seeds = [b"dex_config", dex_config.dex_id.as_bytes()],
        bump = dex_config.bump
    )]
    pub dex_config: Account<'info, DexConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
}
```

#### 3.3.4 使用示例

```typescript
// SDK 方法
async addDex(params: {
    dexId: string,
    programId: PublicKey,
    dexType: DexType,
}): Promise<string> {
    const [routerState] = this.getRouterStatePDA();
    const [dexConfig] = this.getDexConfigPDA(params.dexId);

    return this.program.methods
        .addDex(params.dexId, params.programId, this.getDexTypeEnum(params.dexType))
        .accounts({
            routerState,
            dexConfig,
            authority: this.provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        })
        .rpc();
}

// 使用示例
await sdk.addDex({
    dexId: "meteora",
    programId: new PublicKey("METAmTMXwdb8gYzyCPfXXFmZZw4rUsXX58PNsDg7zjL"),
    dexType: DexType.Meteora,
});

// 临时禁用某个 DEX
await sdk.toggleDex("jupiter", false);

// 恢复启用
await sdk.toggleDex("jupiter", true);

// 删除 DEX（回收租金）
await sdk.removeDex("old_dex_id");
```

### 3.4 核心交换功能

**指令签名**:

```rust
pub fn swap(
    ctx: Context<Swap>,
    amount_in: u64,
    minimum_amount_out: u64,
    dex_type: DexType,
) -> Result<()>
```

**完整实现**:

```rust
pub fn swap(
    ctx: Context<Swap>,
    amount_in: u64,
    minimum_amount_out: u64,
    dex_type: DexType,
) -> Result<()> {
    // ===== 1. 安全检查 =====
    require!(!ctx.accounts.router_state.paused, ErrorCode::Paused);
    require!(amount_in > 0, ErrorCode::InvalidAmount);
    require!(
        ctx.accounts.token_in_config.enabled,
        ErrorCode::TokenDisabled
    );
    require!(
        ctx.accounts.token_out_config.enabled,
        ErrorCode::TokenDisabled
    );

    // ===== 2. 计算费用 =====
    let fee_bps = if ctx.accounts.token_in_config.custom_fee_bps > 0 {
        ctx.accounts.token_in_config.custom_fee_bps
    } else {
        ctx.accounts.router_state.default_fee_bps
    };

    // 使用 checked 操作防止溢出
    let fee = (amount_in as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::DivisionByZero)? as u64;

    let amount_after_fee = amount_in
        .checked_sub(fee)
        .ok_or(ErrorCode::InsufficientAmount)?;

    // ===== 3. 收取协议费用 =====
    if fee > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_in.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // ===== 4. 记录交换前余额 =====
    ctx.accounts.user_token_out.reload()?;
    let balance_before = ctx.accounts.user_token_out.amount;

    // ===== 5. 执行 DEX 交换 =====
    match dex_type {
        DexType::Jupiter => {
            execute_jupiter_swap(&ctx, amount_after_fee, minimum_amount_out)?;
        }
        DexType::Raydium => {
            execute_raydium_swap(&ctx, amount_after_fee, minimum_amount_out)?;
        }
        DexType::Orca => {
            execute_orca_swap(&ctx, amount_after_fee, minimum_amount_out)?;
        }
        DexType::Phoenix => {
            execute_phoenix_swap(&ctx, amount_after_fee, minimum_amount_out)?;
        }
    }

    // ===== 6. 验证输出金额 =====
    ctx.accounts.user_token_out.reload()?;
    let balance_after = ctx.accounts.user_token_out.amount;
    let amount_out = balance_after
        .checked_sub(balance_before)
        .ok_or(ErrorCode::InvalidOutput)?;

    require!(
        amount_out >= minimum_amount_out,
        ErrorCode::SlippageTooHigh
    );

    // ===== 7. 更新统计数据 =====
    ctx.accounts.token_in_config.volume = ctx.accounts.token_in_config
        .volume
        .checked_add(amount_in)
        .ok_or(ErrorCode::Overflow)?;

    ctx.accounts.token_in_config.fees_collected = ctx.accounts.token_in_config
        .fees_collected
        .checked_add(fee)
        .ok_or(ErrorCode::Overflow)?;

    // ===== 8. 发出事件 =====
    emit!(SwapExecuted {
        user: ctx.accounts.user.key(),
        token_in: ctx.accounts.token_in_config.mint,
        token_out: ctx.accounts.token_out_config.mint,
        amount_in,
        amount_out,
        fee,
        dex: dex_type,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

### 3.5 DEX 集成模块

#### 3.5.1 Jupiter 集成（推荐）

```rust
fn execute_jupiter_swap(
    ctx: &Context<Swap>,
    amount: u64,
    minimum_out: u64,
) -> Result<()> {
    // Jupiter 使用 shared_accounts_route 或 route 指令
    // 具体账户通过 remaining_accounts 传入

    let cpi_program = ctx.accounts.jupiter_program.to_account_info();

    // Jupiter CPI 调用
    jupiter::cpi::shared_accounts_route(
        CpiContext::new_with_remaining_accounts(
            cpi_program,
            jupiter::SharedAccountsRoute {
                token_program: ctx.accounts.token_program.to_account_info(),
                user_transfer_authority: ctx.accounts.user.to_account_info(),
                user_source_token_account: ctx.accounts.user_token_in.to_account_info(),
                user_destination_token_account: ctx.accounts.user_token_out.to_account_info(),
                // ... 其他必需账户
            },
            ctx.remaining_accounts.to_vec(),
        ),
        amount,
        minimum_out,
    )?;

    Ok(())
}
```

#### 3.5.2 Raydium AMM 集成

```rust
fn execute_raydium_swap(
    ctx: &Context<Swap>,
    amount: u64,
    minimum_out: u64,
) -> Result<()> {
    // Raydium AMM swap
    raydium_amm::cpi::swap(
        CpiContext::new(
            ctx.accounts.raydium_program.to_account_info(),
            raydium_amm::Swap {
                amm: ctx.remaining_accounts[0].clone(),
                amm_authority: ctx.remaining_accounts[1].clone(),
                amm_open_orders: ctx.remaining_accounts[2].clone(),
                pool_coin_token_account: ctx.remaining_accounts[3].clone(),
                pool_pc_token_account: ctx.remaining_accounts[4].clone(),
                serum_program: ctx.remaining_accounts[5].clone(),
                serum_market: ctx.remaining_accounts[6].clone(),
                serum_bids: ctx.remaining_accounts[7].clone(),
                serum_asks: ctx.remaining_accounts[8].clone(),
                serum_event_queue: ctx.remaining_accounts[9].clone(),
                serum_coin_vault: ctx.remaining_accounts[10].clone(),
                serum_pc_vault: ctx.remaining_accounts[11].clone(),
                serum_vault_signer: ctx.remaining_accounts[12].clone(),
                user_source_token_account: ctx.accounts.user_token_in.to_account_info(),
                user_destination_token_account: ctx.accounts.user_token_out.to_account_info(),
                user_source_owner: ctx.accounts.user.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ),
        amount,
        minimum_out,
    )?;

    Ok(())
}
```

#### 3.5.3 Orca Whirlpool 集成

```rust
fn execute_orca_swap(
    ctx: &Context<Swap>,
    amount: u64,
    minimum_out: u64,
) -> Result<()> {
    // Orca Whirlpool swap
    whirlpool::cpi::swap(
        CpiContext::new(
            ctx.accounts.orca_program.to_account_info(),
            whirlpool::Swap {
                whirlpool: ctx.remaining_accounts[0].clone(),
                token_authority: ctx.accounts.user.to_account_info(),
                token_owner_account_a: ctx.accounts.user_token_in.to_account_info(),
                token_vault_a: ctx.remaining_accounts[1].clone(),
                token_owner_account_b: ctx.accounts.user_token_out.to_account_info(),
                token_vault_b: ctx.remaining_accounts[2].clone(),
                tick_array_0: ctx.remaining_accounts[3].clone(),
                tick_array_1: ctx.remaining_accounts[4].clone(),
                tick_array_2: ctx.remaining_accounts[5].clone(),
                oracle: ctx.remaining_accounts[6].clone(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ),
        amount,
        minimum_out,
        0, // sqrt_price_limit (0 = no limit)
        true, // a_to_b direction
    )?;

    Ok(())
}
```

### 3.6 费用提取

**指令签名**:

```rust
pub fn withdraw_fees(
    ctx: Context<WithdrawFees>,
    amount: u64,
) -> Result<()>
```

**完整实现**:

```rust
/// 提取累积的协议费用
pub fn withdraw_fees(
    ctx: Context<WithdrawFees>,
    amount: u64,
) -> Result<()> {
    // 仅管理员可以提取
    require!(
        ctx.accounts.router_state.authority == ctx.accounts.authority.key(),
        ErrorCode::Unauthorized
    );

    // 验证提取金额
    let fee_vault_balance = ctx.accounts.fee_vault.amount;
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(amount <= fee_vault_balance, ErrorCode::InsufficientBalance);

    // 使用 PDA signer 从 fee_vault 转账到目标账户
    let seeds = &[
        b"fee_vault",
        ctx.accounts.token_mint.key().as_ref(),
        &[ctx.bumps.fee_vault]
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fee_vault.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.fee_vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // 更新统计（可选）
    ctx.accounts.token_config.fees_collected = ctx.accounts.token_config
        .fees_collected
        .checked_sub(amount)
        .ok_or(ErrorCode::Underflow)?;

    emit!(FeesWithdrawn {
        token: ctx.accounts.token_mint.key(),
        amount,
        recipient: ctx.accounts.destination.owner,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        mut,
        seeds = [b"router_state"],
        bump = router_state.bump
    )]
    pub router_state: Account<'info, RouterState>,

    #[account(
        mut,
        seeds = [b"token_config", token_mint.key().as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// 费用金库（PDA，程序控制）
    #[account(
        mut,
        seeds = [b"fee_vault", token_mint.key().as_ref()],
        bump
    )]
    pub fee_vault: Account<'info, TokenAccount>,

    /// 目标账户（通常是 fee_recipient 的 ATA）
    #[account(
        mut,
        constraint = destination.owner == router_state.fee_recipient @ ErrorCode::InvalidRecipient
    )]
    pub destination: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    /// 管理员签名（推荐使用多签）
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
```

**SDK 方法**:

```typescript
async withdrawFees(params: {
    tokenMint: PublicKey,
    amount: number | BN,
}): Promise<string> {
    const [routerState] = this.getRouterStatePDA();
    const [tokenConfig] = this.getTokenConfigPDA(params.tokenMint);
    const [feeVault] = this.getFeeVaultPDA(params.tokenMint);

    // 获取 fee_recipient 的 ATA
    const state = await this.getRouterState();
    const destination = await getAssociatedTokenAddress(
        params.tokenMint,
        state.feeRecipient
    );

    return this.program.methods
        .withdrawFees(new BN(params.amount))
        .accounts({
            routerState,
            tokenConfig,
            feeVault,
            destination,
            tokenMint: params.tokenMint,
            authority: this.provider.wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
}

// 使用示例
await sdk.withdrawFees({
    tokenMint: USDC_MINT,
    amount: 1_000_000_000, // 1000 USDC
});
```

---

## 四、安全性设计

### 4.1 权限控制

```rust
// 管理员验证宏
#[macro_export]
macro_rules! require_admin {
    ($state:expr, $authority:expr) => {
        require!(
            $state.authority == $authority.key(),
            ErrorCode::Unauthorized
        );
    };
}

// 紧急暂停
pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
    require_admin!(ctx.accounts.router_state, ctx.accounts.authority);

    ctx.accounts.router_state.paused = true;

    emit!(RouterPaused {
        authority: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

// 恢复运行
pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
    require_admin!(ctx.accounts.router_state, ctx.accounts.authority);

    ctx.accounts.router_state.paused = false;

    emit!(RouterUnpaused {
        authority: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

// 转移管理权（支持多签场景）
pub fn transfer_authority(
    ctx: Context<TransferAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    require_admin!(ctx.accounts.router_state, ctx.accounts.authority);

    let old_authority = ctx.accounts.router_state.authority;
    ctx.accounts.router_state.authority = new_authority;

    emit!(AuthorityTransferred {
        old_authority,
        new_authority,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

### 4.2 数值安全

```rust
// 所有算术操作使用 checked 方法
let fee = (amount_in as u128)
    .checked_mul(fee_bps as u128)
    .ok_or(ErrorCode::Overflow)?
    .checked_div(10000)
    .ok_or(ErrorCode::DivisionByZero)? as u64;

let amount_after_fee = amount_in
    .checked_sub(fee)
    .ok_or(ErrorCode::InsufficientAmount)?;

// 边界检查
require!(fee_bps <= 100, ErrorCode::FeeTooHigh);  // 最大 1%
require!(amount_in > 0, ErrorCode::InvalidAmount);
```

### 4.3 多签管理（强烈推荐）

#### 为什么使用多签而不是单签？

**单签的风险**:

```
❌ 单点故障风险:
- 私钥泄露 → 协议被永久锁定或资金被盗
- 私钥丢失 → 无法管理协议和提取费用
- 内部作恶 → 单人可以滥用权限
- 不符合审计要求 → 难以通过安全审核
```

**多签的优势**:

```
✅ 分散风险:
- 需要多个签名才能执行关键操作
- 一个密钥泄露不会导致整个协议被攻破
- 防止内部作恶（需要合谋）
- 符合审计和合规要求
```

#### 多签配置建议

| 场景         | 多签配置 | 说明                             |
| ------------ | -------- | -------------------------------- |
| **小型项目** | 2/3      | 创始人 + 技术负责人 + 运营负责人 |
| **中型项目** | 3/5      | 核心团队 + 1-2 个顾问            |
| **大型项目** | 4/7      | 核心团队 + 社区代表 + 投资者     |
| **DAO 治理** | 5/9      | 完全去中心化的社区选举           |

#### 使用 Squads Protocol 实现多签

```typescript
// 1. 创建多签钱包
import { Squads } from "@sqds/sdk"

const squads = Squads.endpoint("https://api.mainnet-beta.solana.com", wallet)

// 创建 3/5 多签
const multisig = await squads.createMultisig({
  threshold: 3, // 需要 3 个签名
  members: [
    adminWallet1.publicKey,
    adminWallet2.publicKey,
    adminWallet3.publicKey,
    adminWallet4.publicKey,
    adminWallet5.publicKey,
  ],
  name: "Universal Router Multisig",
})

console.log("Multisig address:", multisig.publicKey.toString())

// 2. 初始化路由器时使用多签地址
await sdk.initialize({
  authority: multisig.publicKey, // 使用多签地址而不是单个钱包
  defaultFeeBps: 4,
})
```

#### 多签操作流程

```typescript
// === 提取费用的多签流程 ===

// 步骤 1: 管理员 A 创建提案
const proposal = await squads.createTransaction({
  multisig: multisigAddress,
  authorityIndex: 0,
  transactionMessage: await sdk.buildWithdrawFeesTransaction({
    tokenMint: USDC_MINT,
    amount: 1000_000_000,
  }),
})

console.log("📝 Proposal created:", proposal.publicKey)

// 步骤 2: 管理员 B 批准
await squads.approveTransaction({
  multisig: multisigAddress,
  transaction: proposal.publicKey,
})
console.log("✅ Admin B approved")

// 步骤 3: 管理员 C 批准
await squads.approveTransaction({
  multisig: multisigAddress,
  transaction: proposal.publicKey,
})
console.log("✅ Admin C approved")

// 步骤 4: 达到阈值（3/5），执行交易
await squads.executeTransaction({
  multisig: multisigAddress,
  transaction: proposal.publicKey,
})

console.log("💰 Fees withdrawn with 3/5 signatures")
```

#### 多签管理最佳实践

```typescript
// 费用监控和定期提取
async function monitorAndWithdrawFees() {
  const tokens = await sdk.getAllSupportedTokens()

  for (const token of tokens) {
    const vault = await sdk.getFeeVault(token.mint)

    // 如果累积超过阈值，创建提取提案
    if (vault.amount > WITHDRAWAL_THRESHOLD) {
      await squads.proposeWithdrawal({
        multisig: multisigAddress,
        tokenMint: token.mint,
        amount: vault.amount,
        title: `Weekly ${token.symbol} fee collection`,
        description: `Collected: ${vault.amount} ${token.symbol}`,
      })

      await notifyAdmins(`New withdrawal proposal for ${token.symbol}`)
    }
  }
}

// 每周自动运行
setInterval(monitorAndWithdrawFees, 7 * 24 * 60 * 60 * 1000)
```

#### 部署时的多签设置

```bash
# 1. 使用 Squads CLI 创建多签（推荐）
squads create-multisig \
    --threshold 3 \
    --members <pubkey1>,<pubkey2>,<pubkey3>,<pubkey4>,<pubkey5> \
    --name "UniversalRouter Multisig"

# 输出: 多签地址
# 例如: 7kXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# 2. 初始化路由器（使用多签地址）
ts-node scripts/initialize.ts \
    --authority 7kXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    --fee-bps 4

# 3. 之后所有管理员操作都需要多签批准
```

**安全提示**:

- ✅ **推荐**: 3/5 或 4/7 多签（平衡安全性和操作效率）
- ⚠️ **不推荐**: 2/2 多签（一个密钥丢失会锁定协议）
- ❌ **禁止**: 单签用于 Mainnet 生产环境

### 4.4 账户验证

```rust
#[derive(Accounts)]
pub struct Swap<'info> {
    // 全局状态验证
    #[account(
        mut,
        seeds = [b"router_state"],
        bump = router_state.bump,
        constraint = !router_state.paused @ ErrorCode::Paused
    )]
    pub router_state: Account<'info, RouterState>,

    // Token 配置验证
    #[account(
        seeds = [b"token_config", token_in_mint.key().as_ref()],
        bump = token_in_config.bump,
        constraint = token_in_config.enabled @ ErrorCode::TokenDisabled,
        constraint = token_in_config.mint == token_in_mint.key() @ ErrorCode::InvalidMint
    )]
    pub token_in_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [b"token_config", token_out_mint.key().as_ref()],
        bump = token_out_config.bump,
        constraint = token_out_config.enabled @ ErrorCode::TokenDisabled,
        constraint = token_out_config.mint == token_out_mint.key() @ ErrorCode::InvalidMint
    )]
    pub token_out_config: Account<'info, TokenConfig>,

    // 用户账户验证
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_token_in.owner == user.key() @ ErrorCode::InvalidOwner,
        constraint = user_token_in.mint == token_in_mint.key() @ ErrorCode::InvalidMint
    )]
    pub user_token_in: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_out.owner == user.key() @ ErrorCode::InvalidOwner,
        constraint = user_token_out.mint == token_out_mint.key() @ ErrorCode::InvalidMint
    )]
    pub user_token_out: Account<'info, TokenAccount>,

    // Token Mint 验证
    pub token_in_mint: Account<'info, Mint>,
    pub token_out_mint: Account<'info, Mint>,

    // 费用金库（PDA）
    #[account(
        mut,
        seeds = [b"fee_vault", token_in_mint.key().as_ref()],
        bump
    )]
    pub fee_vault: Account<'info, TokenAccount>,

    // 程序引用
    pub token_program: Program<'info, Token>,
    /// CHECK: DEX program (Jupiter/Raydium/Orca)
    pub dex_program: UncheckedAccount<'info>,

    // remaining_accounts: DEX 特定的路由账户
}
```

### 4.4 CPI 安全

```rust
// 验证 DEX 程序 ID
const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB");
const RAYDIUM_PROGRAM_ID: Pubkey = pubkey!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const ORCA_PROGRAM_ID: Pubkey = pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

require!(
    ctx.accounts.dex_program.key() == expected_program_id,
    ErrorCode::InvalidDexProgram
);

// 验证账户所有权
require!(
    ctx.accounts.user_token_in.owner == ctx.accounts.user.key(),
    ErrorCode::InvalidTokenOwner
);
```

### 4.5 错误码定义

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Program is paused")]
    Paused,

    #[msg("Unauthorized: caller is not the authority")]
    Unauthorized,

    #[msg("Fee too high: maximum 1%")]
    FeeTooHigh,

    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,

    #[msg("Token is disabled")]
    TokenDisabled,

    #[msg("Token not supported")]
    TokenNotSupported,

    #[msg("Insufficient amount after fee")]
    InsufficientAmount,

    #[msg("Insufficient balance in fee vault")]
    InsufficientBalance,

    #[msg("Slippage too high: output below minimum")]
    SlippageTooHigh,

    #[msg("Invalid output amount")]
    InvalidOutput,

    #[msg("Math overflow")]
    Overflow,

    #[msg("Math underflow")]
    Underflow,

    #[msg("Division by zero")]
    DivisionByZero,

    #[msg("Invalid mint address")]
    InvalidMint,

    #[msg("Invalid token account owner")]
    InvalidOwner,

    #[msg("Invalid DEX program")]
    InvalidDexProgram,

    #[msg("Invalid recipient address")]
    InvalidRecipient,
}
```

### 4.6 事件定义

```rust
// 路由器事件
#[event]
pub struct RouterInitialized {
    pub authority: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct RouterPaused {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RouterUnpaused {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityTransferred {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

// Token 管理事件
#[event]
pub struct TokenAdded {
    pub mint: Pubkey,
    pub custom_fee_bps: u16,
}

#[event]
pub struct TokenToggled {
    pub mint: Pubkey,
    pub enabled: bool,
}

#[event]
pub struct TokenRemoved {
    pub mint: Pubkey,
}

// 交换事件
#[event]
pub struct SwapExecuted {
    pub user: Pubkey,
    pub token_in: Pubkey,
    pub token_out: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub fee: u64,
    pub dex: DexType,
    pub timestamp: i64,
}

// 费用提取事件
#[event]
pub struct FeesWithdrawn {
    pub token: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
    pub timestamp: i64,
}
```

## 五、性能优化

### 5.1 计算单元（CU）优化

| 操作             | 预计 CU   | 优化措施       |
| ---------------- | --------- | -------------- |
| 初始化路由器     | ~30k      | 最小化状态账户 |
| 添加 Token       | ~25k      | 紧凑数据结构   |
| 启用/禁用 Token  | ~8k       | 仅更新单个字段 |
| 删除 Token       | ~10k      | 关闭账户       |
| **Jupiter Swap** | **~120k** | 最优聚合器     |
| **Raydium Swap** | **~80k**  | 直接 AMM       |
| **Orca Swap**    | **~90k**  | Whirlpool      |

**优化技巧**:

```rust
// 1. 使用紧凑的数据类型
pub default_fee_bps: u16,  // 而不是 u64

// 2. 控制函数内联
#[inline(never)]  // 减少 CU 消耗
fn transfer_fee() { }

// 3. 最小化 PDA 种子长度
seeds = [b"config", mint.as_ref()]  // 简短清晰

// 4. 批量操作
pub fn batch_add_tokens(
    ctx: Context<BatchAddTokens>,
    tokens: Vec<TokenParams>,
) -> Result<()>

// 5. 使用地址查找表（LUT）
// 客户端创建 LUT 包含常用账户
```

### 5.2 存储优化

```rust
// 账户空间计算
RouterState:    8 + 79  = 87 bytes   (~0.0006 SOL 租金)
TokenConfig:    8 + 93  = 101 bytes  (~0.0007 SOL 租金)
RouteConfig:    8 + 83  = 91 bytes   (~0.0006 SOL 租金)

// 支持 100 个 token 的总成本
初始化: 0.0006 SOL
100 个 token: 0.0007 * 100 = 0.07 SOL
总计: ~0.0706 SOL (~$7 USD)
```

### 5.3 交易费用对比

```
用户交换 1000 USDC:

方案 A: 直接使用 Jupiter
- CU 费用: ~0.00008 SOL
- 协议费: 0
- 总成本: ~0.00008 SOL

方案 B: 通过 UniversalRouter + Jupiter
- CU 费用: ~0.00012 SOL
- 协议费: 0.04% = 0.4 USDC
- 总成本: ~0.00012 SOL + 0.4 USDC

增加成本: 0.04% + 0.00004 SOL (可忽略)
```

---

## 六、客户端 SDK

### 6.1 TypeScript SDK

```typescript
import { Program, AnchorProvider, BN, web3 } from "@coral-xyz/anchor"
import { PublicKey, Transaction } from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"

export enum DexType {
  Jupiter = "jupiter",
  Raydium = "raydium",
  Orca = "orca",
  Phoenix = "phoenix",
}

export class UniversalRouterSDK {
  constructor(
    private program: Program,
    private provider: AnchorProvider,
  ) {}

  // ===== 管理员功能 =====

  async initialize(defaultFeeBps: number): Promise<string> {
    const [routerState] = this.getRouterStatePDA()
    const feeRecipient = this.provider.wallet.publicKey

    return this.program.methods
      .initialize(defaultFeeBps)
      .accounts({
        routerState,
        authority: this.provider.wallet.publicKey,
        feeRecipient,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
  }

  async addToken(params: {
    mint: PublicKey
    customFeeBps: number
    pythPriceFeed?: PublicKey
  }): Promise<string> {
    const [routerState] = this.getRouterStatePDA()
    const [tokenConfig] = this.getTokenConfigPDA(params.mint)

    return this.program.methods
      .addToken(params.customFeeBps, params.pythPriceFeed || null)
      .accounts({
        routerState,
        tokenConfig,
        tokenMint: params.mint,
        authority: this.provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
  }

  async toggleToken(mint: PublicKey, enabled: boolean): Promise<string> {
    const [routerState] = this.getRouterStatePDA()
    const [tokenConfig] = this.getTokenConfigPDA(mint)

    return this.program.methods
      .toggleToken(enabled)
      .accounts({
        routerState,
        tokenConfig,
        authority: this.provider.wallet.publicKey,
      })
      .rpc()
  }

  async removeToken(mint: PublicKey): Promise<string> {
    const [routerState] = this.getRouterStatePDA()
    const [tokenConfig] = this.getTokenConfigPDA(mint)

    return this.program.methods
      .removeToken()
      .accounts({
        routerState,
        tokenConfig,
        authority: this.provider.wallet.publicKey,
      })
      .rpc()
  }

  // ===== 用户功能 =====

  async swap(params: {
    tokenIn: PublicKey
    tokenOut: PublicKey
    amountIn: number | BN
    minAmountOut: number | BN
    dexType: DexType
  }): Promise<string> {
    const [routerState] = this.getRouterStatePDA()
    const [tokenInConfig] = this.getTokenConfigPDA(params.tokenIn)
    const [tokenOutConfig] = this.getTokenConfigPDA(params.tokenOut)

    const userTokenIn = await getAssociatedTokenAddress(
      params.tokenIn,
      this.provider.wallet.publicKey,
    )

    const userTokenOut = await getAssociatedTokenAddress(
      params.tokenOut,
      this.provider.wallet.publicKey,
    )

    const [feeVault] = this.getFeeVaultPDA(params.tokenIn)

    // 获取 DEX 特定的路由账户
    const { dexProgram, remainingAccounts } = await this.getDexAccounts(
      params.dexType,
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
    )

    return this.program.methods
      .swap(
        new BN(params.amountIn),
        new BN(params.minAmountOut),
        this.getDexTypeEnum(params.dexType),
      )
      .accounts({
        routerState,
        tokenInConfig,
        tokenOutConfig,
        user: this.provider.wallet.publicKey,
        userTokenIn,
        userTokenOut,
        tokenInMint: params.tokenIn,
        tokenOutMint: params.tokenOut,
        feeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        dexProgram,
      })
      .remainingAccounts(remainingAccounts)
      .rpc()
  }

  // ===== 查询功能 =====

  async getRouterState() {
    const [routerState] = this.getRouterStatePDA()
    return this.program.account.routerState.fetch(routerState)
  }

  async getTokenConfig(mint: PublicKey) {
    const [tokenConfig] = this.getTokenConfigPDA(mint)
    return this.program.account.tokenConfig.fetch(tokenConfig)
  }

  async getAllSupportedTokens() {
    return this.program.account.tokenConfig.all([
      {
        memcmp: {
          offset: 8 + 32, // discriminator + mint
          bytes: bs58.encode([1]), // enabled = true
        },
      },
    ])
  }

  async getTokenStats(mint: PublicKey) {
    const config = await this.getTokenConfig(mint)
    return {
      mint: config.mint,
      enabled: config.enabled,
      volume: config.volume.toString(),
      feesCollected: config.feesCollected.toString(),
      customFeeBps: config.customFeeBps,
    }
  }

  // ===== 辅助方法 =====

  private getRouterStatePDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      this.program.programId,
    )
  }

  private getTokenConfigPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("token_config"), mint.toBuffer()],
      this.program.programId,
    )
  }

  private getFeeVaultPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault"), mint.toBuffer()],
      this.program.programId,
    )
  }

  private async getDexAccounts(
    dexType: DexType,
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amount: number | BN,
  ): Promise<{
    dexProgram: PublicKey
    remainingAccounts: web3.AccountMeta[]
  }> {
    switch (dexType) {
      case DexType.Jupiter:
        return this.getJupiterAccounts(tokenIn, tokenOut, amount)
      case DexType.Raydium:
        return this.getRaydiumAccounts(tokenIn, tokenOut)
      case DexType.Orca:
        return this.getOrcaAccounts(tokenIn, tokenOut)
      case DexType.Phoenix:
        return this.getPhoenixAccounts(tokenIn, tokenOut)
    }
  }

  private async getJupiterAccounts(
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amount: number | BN,
  ) {
    // 调用 Jupiter API 获取路由
    const quote = await fetch(
      `https://quote-api.jup.ag/v6/quote?` +
        `inputMint=${tokenIn.toString()}&` +
        `outputMint=${tokenOut.toString()}&` +
        `amount=${amount.toString()}`,
    ).then((res) => res.json())

    // 从 quote 提取路由账户
    const remainingAccounts = this.parseJupiterRoute(quote)

    return {
      dexProgram: JUPITER_PROGRAM_ID,
      remainingAccounts,
    }
  }

  private getDexTypeEnum(dexType: DexType) {
    return { [dexType]: {} }
  }
}
```

### 6.2 React Hooks

```typescript
import { useCallback, useEffect, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"

// useSwap hook
export function useSwap() {
  const wallet = useWallet()
  const { connection } = useConnection()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const sdk = useMemo(
    () => new UniversalRouterSDK(program, provider),
    [connection, wallet],
  )

  const swap = useCallback(
    async (params: SwapParams) => {
      setLoading(true)
      setError(null)

      try {
        const signature = await sdk.swap(params)
        await connection.confirmTransaction(signature)
        return signature
      } catch (err) {
        setError(err as Error)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [sdk, connection],
  )

  return { swap, loading, error }
}

// useTokens hook
export function useTokens() {
  const [tokens, setTokens] = useState<TokenConfig[]>([])
  const [loading, setLoading] = useState(true)
  const sdk = useSDK()

  useEffect(() => {
    sdk
      .getAllSupportedTokens()
      .then(setTokens)
      .finally(() => setLoading(false))
  }, [sdk])

  return { tokens, loading }
}

// useTokenStats hook
export function useTokenStats(mint: PublicKey) {
  const [stats, setStats] = useState(null)
  const sdk = useSDK()

  useEffect(() => {
    sdk.getTokenStats(mint).then(setStats)
  }, [mint, sdk])

  return stats
}
```

### 6.3 使用示例

```typescript
// 简单交换
import { UniversalRouterSDK, DexType } from '@universal-router/sdk';

const sdk = new UniversalRouterSDK(program, provider);

// 交换 SOL -> USDC
const signature = await sdk.swap({
    tokenIn: SOL_MINT,
    tokenOut: USDC_MINT,
    amountIn: 1_000_000_000, // 1 SOL
    minAmountOut: 180_000_000, // 180 USDC
    dexType: DexType.Jupiter,
});

console.log('交换成功：', signature);

// React 组件中使用
function SwapComponent() {
    const { swap, loading } = useSwap();
    const { tokens } = useTokens();

    const handleSwap = async () => {
        await swap({
            tokenIn: selectedTokenIn,
            tokenOut: selectedTokenOut,
            amountIn: amount,
            minAmountOut: minAmount,
            dexType: DexType.Jupiter,
        });
    };

    return (
        <button onClick={handleSwap} disabled={loading}>
            {loading ? '交换中...' : '交换'}
        </button>
    );
}
```

---

## 七、测试策略

### 7.1 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fee_calculation() {
        let amount = 1_000_000_000; // 1000 USDC (6 decimals)
        let fee_bps = 4; // 0.04%
        let fee = (amount * fee_bps) / 10000;
        assert_eq!(fee, 400_000); // 0.4 USDC
    }

    #[test]
    fn test_fee_calculation_with_overflow_protection() {
        let amount: u64 = u64::MAX;
        let fee_bps: u16 = 4;

        let fee = (amount as u128)
            .checked_mul(fee_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        assert!(fee > 0);
    }

    #[test]
    fn test_max_fee_validation() {
        let fee_bps = 100; // 1%
        assert!(fee_bps <= 100);

        let fee_bps = 101; // 1.01% - should fail
        assert!(fee_bps > 100);
    }
}
```

### 7.2 集成测试

```typescript
import * as anchor from "@coral-xyz/anchor"
import { assert } from "chai"

describe("UniversalRouter Integration Tests", () => {
  let sdk: UniversalRouterSDK
  let provider: anchor.AnchorProvider

  before(async () => {
    provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)
    sdk = new UniversalRouterSDK(program, provider)
  })

  describe("Initialization", () => {
    it("Should initialize router with default fee", async () => {
      const tx = await sdk.initialize(4) // 0.04%
      const state = await sdk.getRouterState()

      assert.equal(state.defaultFeeBps, 4)
      assert.equal(state.paused, false)
      assert.equal(state.totalTokens, 0)
    })
  })

  describe("Token Management", () => {
    it("Should add token successfully", async () => {
      await sdk.addToken({
        mint: USDC_MINT,
        customFeeBps: 0, // 使用默认费率
        pythPriceFeed: USDC_PYTH_FEED,
      })

      const config = await sdk.getTokenConfig(USDC_MINT)
      assert.equal(config.enabled, true)
      assert.equal(config.mint.toString(), USDC_MINT.toString())
    })

    it("Should toggle token status", async () => {
      await sdk.toggleToken(USDC_MINT, false)
      let config = await sdk.getTokenConfig(USDC_MINT)
      assert.equal(config.enabled, false)

      await sdk.toggleToken(USDC_MINT, true)
      config = await sdk.getTokenConfig(USDC_MINT)
      assert.equal(config.enabled, true)
    })

    it("Should prevent adding token with excessive fee", async () => {
      try {
        await sdk.addToken({
          mint: SOL_MINT,
          customFeeBps: 101, // > 1%
        })
        assert.fail("Should have thrown error")
      } catch (err) {
        assert.include(err.message, "FeeTooHigh")
      }
    })
  })

  describe("Swap Functionality", () => {
    it("Should execute swap via Jupiter", async () => {
      const amountIn = 1_000_000_000 // 1 SOL
      const minOut = 180_000_000 // 180 USDC

      const signature = await sdk.swap({
        tokenIn: SOL_MINT,
        tokenOut: USDC_MINT,
        amountIn,
        minAmountOut: minOut,
        dexType: DexType.Jupiter,
      })

      assert.isString(signature)

      // 验证统计数据更新
      const config = await sdk.getTokenConfig(SOL_MINT)
      assert.isAbove(config.volume.toNumber(), 0)
    })

    it("Should reject swap when paused", async () => {
      // 暂停路由器
      await sdk.pause()

      try {
        await sdk.swap({
          tokenIn: SOL_MINT,
          tokenOut: USDC_MINT,
          amountIn: 1_000_000,
          minAmountOut: 1_000,
          dexType: DexType.Jupiter,
        })
        assert.fail("Should have thrown error")
      } catch (err) {
        assert.include(err.message, "Paused")
      }

      // 恢复
      await sdk.unpause()
    })

    it("Should reject swap with disabled token", async () => {
      await sdk.toggleToken(USDC_MINT, false)

      try {
        await sdk.swap({
          tokenIn: SOL_MINT,
          tokenOut: USDC_MINT,
          amountIn: 1_000_000,
          minAmountOut: 1_000,
          dexType: DexType.Jupiter,
        })
        assert.fail("Should have thrown error")
      } catch (err) {
        assert.include(err.message, "TokenDisabled")
      }

      await sdk.toggleToken(USDC_MINT, true)
    })
  })

  describe("Fee Collection", () => {
    it("Should collect correct protocol fee", async () => {
      const amountIn = 1_000_000_000 // 1000 USDC
      const feeBps = 4 // 0.04%
      const expectedFee = (amountIn * feeBps) / 10000

      const configBefore = await sdk.getTokenConfig(USDC_MINT)
      const feesBefore = configBefore.feesCollected.toNumber()

      await sdk.swap({
        tokenIn: USDC_MINT,
        tokenOut: SOL_MINT,
        amountIn,
        minAmountOut: 1_000_000,
        dexType: DexType.Jupiter,
      })

      const configAfter = await sdk.getTokenConfig(USDC_MINT)
      const feesAfter = configAfter.feesCollected.toNumber()

      assert.equal(feesAfter - feesBefore, expectedFee)
    })
  })
})
```

### 7.3 安全测试

```typescript
describe("Security Tests", () => {
  it("Should prevent unauthorized admin actions", async () => {
    const unauthorizedUser = anchor.web3.Keypair.generate()

    try {
      await program.methods
        .pause()
        .accounts({
          routerState,
          authority: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc()
      assert.fail("Should have thrown error")
    } catch (err) {
      assert.include(err.message, "Unauthorized")
    }
  })

  it("Should protect against integer overflow", async () => {
    const maxAmount = new anchor.BN(2)
      .pow(new anchor.BN(64))
      .sub(new anchor.BN(1))

    // 应该正确处理而不是溢出
    try {
      await sdk.swap({
        tokenIn: SOL_MINT,
        tokenOut: USDC_MINT,
        amountIn: maxAmount,
        minAmountOut: 1,
        dexType: DexType.Jupiter,
      })
    } catch (err) {
      // 预期会失败，但不应该因为溢出
      assert.notInclude(err.message.toLowerCase(), "overflow")
    }
  })
})
```

---

## 八、部署计划

### 8.1 环境准备

```bash
# 安装依赖
npm install -g @coral-xyz/anchor-cli
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# 创建项目
anchor init universal-router
cd universal-router

# 安装 Rust 依赖
cargo add anchor-lang anchor-spl pyth-sdk-solana
```

### 8.2 配置文件

**Anchor.toml**:

```toml
[features]
seeds = false
skip-lint = false

[programs.devnet]
universal_router = "UnivXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

[programs.mainnet]
universal_router = "UnivYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

**Cargo.toml**:

```toml
[package]
name = "universal-router"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "universal_router"

[dependencies]
anchor-lang = "0.29.0"
anchor-spl = "0.29.0"
pyth-sdk-solana = "0.9.0"

[dev-dependencies]
solana-program-test = "1.17.0"
solana-sdk = "1.17.0"
```

### 8.3 部署步骤

**Devnet 部署**:

```bash
# 1. 构建程序
anchor build

# 2. 获取程序 ID
solana address -k target/deploy/universal_router-keypair.json

# 3. 更新 lib.rs 和 Anchor.toml 中的程序 ID

# 4. 重新构建
anchor build

# 5. 部署到 Devnet
anchor deploy --provider.cluster devnet

# 6. 初始化路由器
ts-node scripts/initialize.ts --cluster devnet --fee 4

# 7. 添加主流 token
ts-node scripts/add-tokens.ts --cluster devnet
```

**Mainnet 部署检查清单**:

```bash
✓ 安全审计完成（OtterSec / Neodyme）
✓ Devnet 测试至少运行 2 周
✓ 压力测试通过（1000+ 笔交易）
✓ 使用多签钱包作为 authority
✓ 配置监控和告警系统
✓ 准备应急响应计划
✓ 文档完整（用户指南 + 开发文档）
✓ 风险披露和免责声明
```

### 8.4 初始化脚本

```typescript
// scripts/initialize.ts
import { UniversalRouterSDK } from "../sdk"

async function main() {
  const provider = anchor.AnchorProvider.env()
  const sdk = new UniversalRouterSDK(program, provider)

  console.log("🚀 Initializing Universal Router...")

  // 初始化路由器
  const defaultFeeBps = 4 // 0.04%
  const tx = await sdk.initialize(defaultFeeBps)

  console.log("✅ Router initialized:", tx)
  console.log(`   Default fee: ${defaultFeeBps} bps (0.04%)`)

  // 添加主流 token
  const tokens = [
    {
      name: "SOL",
      mint: new PublicKey("So11111111111111111111111111111111111111112"),
      pythFeed: new PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG"),
    },
    {
      name: "USDC",
      mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      pythFeed: new PublicKey("Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD"),
    },
    {
      name: "USDT",
      mint: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
      pythFeed: new PublicKey("3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL"),
    },
  ]

  console.log("\n📝 Adding tokens...")
  for (const token of tokens) {
    const tx = await sdk.addToken({
      mint: token.mint,
      customFeeBps: 0, // 使用默认费率
      pythPriceFeed: token.pythFeed,
    })
    console.log(`✅ Added ${token.name}:`, tx)
  }

  console.log("\n✨ Setup complete!")
}

main().catch(console.error)
```

---

## 九、监控和运维

### 9.1 关键指标

```typescript
interface HealthMetrics {
  // 程序状态
  programDeployed: boolean
  routerStateValid: boolean
  isPaused: boolean

  // 统计数据
  totalTokens: number
  totalVolumeUSD: number
  totalFeesCollected: number

  // 性能指标
  averageCUUsage: number
  successRate: number
  averageLatency: number

  // 时间戳
  lastSwapTimestamp: number
  uptimePercentage: number
}
```

### 9.2 监控脚本

```typescript
// scripts/monitor.ts
async function monitor() {
  const sdk = new UniversalRouterSDK(program, provider)

  while (true) {
    try {
      // 获取路由器状态
      const state = await sdk.getRouterState()

      console.log("📊 Router Health Check:")
      console.log(`   Status: ${state.paused ? "⚠️  PAUSED" : "✅ Active"}`)
      console.log(`   Total Tokens: ${state.totalTokens}`)
      console.log(`   Total Volume: $${state.totalVolumeUsd}`)

      // 检查告警条件
      if (state.paused) {
        await sendAlert("🚨 Router is PAUSED!")
      }

      // 获取所有 token 状态
      const tokens = await sdk.getAllSupportedTokens()
      for (const token of tokens) {
        const stats = await sdk.getTokenStats(token.mint)
        console.log(
          `   ${token.symbol}: ${stats.volume} volume, ${stats.feesCollected} fees`,
        )
      }
    } catch (err) {
      console.error("❌ Monitor error:", err)
      await sendAlert(`Monitor error: ${err.message}`)
    }

    // 每 5 分钟检查一次
    await sleep(5 * 60 * 1000)
  }
}
```

### 9.3 应急响应

**暂停流程**:

```typescript
// scripts/emergency-pause.ts
async function emergencyPause(reason: string) {
  console.log("🚨 EMERGENCY PAUSE INITIATED")
  console.log(`   Reason: ${reason}`)

  const sdk = new UniversalRouterSDK(program, provider)

  // 执行暂停
  const tx = await sdk.pause()
  console.log("✅ Router paused:", tx)

  // 发送通知
  await notifyAllChannels({
    level: "CRITICAL",
    message: `Router paused: ${reason}`,
    action: "All swaps are temporarily disabled",
  })
}
```

---

## 十、成本分析

### 10.1 开发成本

| 项目     | 时间       | 说明                   |
| -------- | ---------- | ---------------------- |
| 合约开发 | 1-2 周     | 核心功能实现           |
| 测试编写 | 1 周       | 单元测试 + 集成测试    |
| SDK 开发 | 1 周       | TypeScript SDK + Hooks |
| 审计准备 | 1 周       | 文档 + 代码审查        |
| **总计** | **4-5 周** | 单人开发               |

### 10.2 运营成本

| 项目           | 成本               | 周期             |
| -------------- | ------------------ | ---------------- |
| 程序部署       | ~5-10 SOL          | 一次性           |
| 账户租金       | ~0.07 SOL          | 一次性（可回收） |
| 安全审计       | $15k-30k           | 一次性           |
| 监控服务器     | $10/月             | 持续             |
| **总启动成本** | **~$500 + 审计费** | -                |

### 10.3 收入模型

```
假设条件:
- 日交易量: $1M
- 协议费率: 0.04%
- 日收入: $1M * 0.04% = $400

月收入: $400 * 30 = $12,000
年收入: $12,000 * 12 = $144,000

ROI: 审计成本回收周期 < 3 个月
```

### 5.1 分级费用结构

| 保护级别   | 费率   | 功能                  | 适用场景                 |
| ---------- | ------ | --------------------- | ------------------------ |
| **BASIC**  | 0.04%  | 滑点保护              | 小额交易、价格不敏感用户 |
| **MEDIUM** | 0.06%  | + Pyth 价格验证（5%） | 中大额交易、需要价格保护 |
| **HIGH**   | 0.10%  | + Jito Bundle（2%）   | 大额交易、专业交易者     |
| **限价单** | +0.02% | 自动化执行费用        | 挂单交易                 |
| **TWAP**   | +0.02% | Clockwork 费用        | 大额分批交易             |

### 5.2 费用分配

```
用户支付费用 100%
├─ 协议费用 80% → Fee Recipient
├─ Jupiter 费用 15% → Jupiter 平台
└─ Clockwork 费用 5% → 自动化执行（仅订单）
```

### 5.3 费用提取

```rust
pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    let amount = token_config.accumulated_fees;

    require!(amount > 0, ErrorCode::NoFeesToWithdraw);

    token_config.accumulated_fees = 0;

    // 使用 PDA signer 转移
    let seeds = &[b"swapper_state", &[ctx.accounts.swapper_state.bump]];
    let signer = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(/*...*/),
        amount,
    )?;

    Ok(())
}
```

---

## 六、安全性设计

### 6.1 权限控制

```rust
// 多签钱包作为 authority
#[account(
    mut,
    constraint = authority.key() == swapper_state.authority @ ErrorCode::Unauthorized
)]
pub authority: Signer<'info>,

// PDA 验证
#[account(
    seeds = [b"token_config", token_mint.as_ref()],
    bump = token_config.bump
)]
pub token_config: Account<'info, TokenConfig>,
```

### 6.2 数值安全

```rust
// 使用 checked 算术
let fee = amount_in
    .checked_mul(fee_bps)
    .ok_or(ErrorCode::MathOverflow)?
    .checked_div(10000)
    .ok_or(ErrorCode::MathOverflow)?;

let amount_after_fee = amount_in
    .checked_sub(fee)
    .ok_or(ErrorCode::InsufficientAmount)?;
```

### 6.3 CPI 安全

```rust
// 验证程序 ID
require!(
    ctx.accounts.jupiter_program.key() == JUPITER_PROGRAM_ID,
    ErrorCode::InvalidProgram
);

// 验证账户所有权
require!(
    ctx.accounts.user_token_account.owner == ctx.accounts.user.key(),
    ErrorCode::InvalidTokenAccount
);
```

### 6.4 紧急暂停

```rust
pub fn pause(ctx: Context<Pause>) -> Result<()> {
    require_admin!(ctx.accounts.swapper_state, ctx.accounts.authority);
    ctx.accounts.swapper_state.paused = true;
    Ok(())
}

pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
    require_admin!(ctx.accounts.swapper_state, ctx.accounts.authority);
    ctx.accounts.swapper_state.paused = false;
    Ok(())
}
```

---

## 七、性能优化

### 7.1 计算单元预算

| 操作        | 预计 CU | 优化措施               |
| ----------- | ------- | ---------------------- |
| BASIC Swap  | ~150k   | Jupiter CPI + 基础验证 |
| MEDIUM Swap | ~200k   | + Pyth CPI (1 次)      |
| HIGH Swap   | ~250k   | + Pyth CPI + Jito 验证 |
| 创建订单    | ~100k   | Clockwork 注册         |
| 执行订单    | ~180k   | 类似 MEDIUM Swap       |
| TWAP 间隔   | ~180k   | 每次间隔执行           |

### 7.2 账户优化

- 使用 `#[derive(InitSpace)]` 精确计算空间
- PDA 种子设计最小化（避免长字符串）
- 订单账户可关闭回收租金

### 7.3 数据结构优化

```rust
// 紧凑的枚举表示
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
#[repr(u8)]
pub enum ProtectionLevel {
    Basic = 0,
    Medium = 1,
    High = 2,
}

// 使用 Option 避免浪费空间
pub limit_price: Option<u64>,  // 仅限价单使用
pub twap_params: Option<TWAPParams>,  // 仅 TWAP 使用
```

---

## 八、测试策略

### 8.1 单元测试

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_fee_calculation() {
        let amount = 1_000_000_000;
        let fee_basic = (amount * 4) / 10000;
        assert_eq!(fee_basic, 400_000);
    }

    #[test]
    fn test_price_deviation() {
        let expected = 1000;
        let actual = 950;
        let deviation = calculate_deviation(expected, actual);
        assert_eq!(deviation, 500); // 5%
    }
}
```

### 8.2 集成测试

```typescript
describe("Swap Tests", () => {
  it("Should execute BASIC swap", async () => {
    const tx = await program.methods
      .swap(amountIn, minOut, { basic: {} })
      .accounts({
        /*...*/
      })
      .rpc()

    expect(tx).to.be.ok
  })

  it("Should reject insufficient output", async () => {
    try {
      await program.methods.swap(amount, tooHighMin, { basic: {} }).rpc()
      fail("Should have thrown")
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("InsufficientOutput")
    }
  })
})
```

### 8.3 Mainnet Fork 测试

```typescript
describe("Jupiter Integration", () => {
  it("Should get real quote", async () => {
    const quote = await jupiterApi.quoteGet({
      inputMint: SOL,
      outputMint: USDC,
      amount: 1_000_000_000,
    })

    expect(quote.data[0].outAmount).to.be.greaterThan(0)
  })
})
```

---

## 九、部署计划

### 9.1 部署阶段

**Phase 1: Devnet（2 周）**

- 部署所有合约
- 集成测试
- Bug 修复
- 性能调优

**Phase 2: Mainnet Beta（4 周）**

- 限制总锁仓量（TVL < 100k USDC）
- 邀请内测用户
- 收集反馈
- 监控稳定性

**Phase 3: 公开发布**

- 完整安全审计
- 移除 TVL 限制
- 市场推广
- 社区治理启动

### 9.2 Mainnet 部署检查清单

- [ ] 安全审计完成（OtterSec / Neodyme）
- [ ] Devnet 运行 2 周无严重问题
- [ ] 压力测试通过（1000+ 交易）
- [ ] 使用多签钱包作为 authority
- [ ] 配置所有主流代币的 Pyth feeds
- [ ] 部署 Keeper 节点
- [ ] 配置 Clockwork
- [ ] 设置监控告警
- [ ] 文档完整
- [ ] 风险披露

### 9.3 监控指标

```typescript
interface HealthMetrics {
  programAccountExists: boolean
  routerStateValid: boolean
  totalVolume: number
  activeOrders: number
  failedTransactions: number
  averageComputeUnits: number
  lastActivityTimestamp: number
}
```

**告警规则**:

- 程序账户不存在 → 🚨 CRITICAL
- Router 被暂停 → ⚠️ WARNING
- 失败率 > 10% → ⚠️ WARNING
- 平均 CU > 200k → ⚠️ WARNING
- 24 小时无活动 → ⚠️ WARNING

---

## 十、运维手册

### 10.1 日常监控

- 每天检查 Discord 告警频道
- 每周审查性能仪表板
- 月度财务报告（费用收入）

### 10.2 紧急响应

**安全漏洞**:

1. 立即使用多签暂停程序
2. 通知所有用户
3. 评估影响
4. 修复并审计
5. 发布事后报告

**高失败率**:

1. 检查 Jupiter API
2. 检查 Pyth feeds
3. 检查 RPC 节点
4. 切换备用基础设施

**Clockwork 故障**:

1. 检查 network 状态
2. 手动触发订单
3. 联系 Clockwork 支持

### 10.3 升级流程

1. Devnet 测试新版本
2. 准备升级公告
3. 多签执行升级
4. 监控 24 小时
5. 发布升级报告

---

## 十一、路线图

### Q1 2026: MVP

- ✅ 核心程序开发
- ✅ Jupiter 集成
- ✅ Pyth 价格验证
- ✅ SDK 开发
- ✅ Devnet 部署

### Q2 2026: Beta

- [ ] Jito 集成（HIGH 保护）
- [ ] 限价单功能
- [ ] TWAP 订单
- [ ] Clockwork 集成
- [ ] 安全审计
- [ ] Mainnet Beta

### Q3 2026: 公开发布

- [ ] 公开启动
- [ ] 前端 dApp
- [ ] 文档完善
- [ ] 社区建设

### Q4 2026: 增强功能

- [ ] 跨链桥接集成
- [ ] 流动性挖矿
- [ ] 治理代币
- [ ] DAO 治理

---

## 十二、成功指标

### 技术指标

- ✅ 交易成功率 > 95%
- ✅ 平均 CU 消耗 < 200k
- ✅ MEV 保护有效性 > 90%
- ✅ 订单执行准确性 > 99%

### 业务指标

- 📊 月交易量 > 10M USDC
- 📊 日活用户 > 1000
- 📊 总锁仓量 > 1M USDC
- 📊 订单完成率 > 95%

### 安全指标

- 🔒 零安全事件
- 🔒 审计问题全部修复
- 🔒 多签治理正常运作

---

## 十三、风险与挑战

### 技术风险

- **Jupiter 依赖**: 如果 Jupiter 停止服务或升级不兼容
  - 缓解：准备备用 DEX 集成（Raydium direct）
- **Pyth 价格延迟**: 市场剧烈波动时价格可能滞后
  - 缓解：使用多个价格源交叉验证
- **Clockwork 可靠性**: 订单执行依赖第三方
  - 缓解：部署备用 Keeper 节点

### 市场风险

- **竞争激烈**: Solana DEX 聚合器众多
  - 差异化：MEV 保护 + 高级订单
- **用户教育**: 三级保护模型可能复杂
  - 缓解：默认推荐 MEDIUM，清晰的 UI 说明

### 监管风险

- **合规要求**: 可能需要 KYC/AML
  - 准备：设计可插拔的合规模块

---

## 十四、总结

### 核心优势

1. **价格最优**: Jupiter 聚合 + 智能路由
2. **用户保护**: 三级 MEV 保护（Pyth + Jito）
3. **专业功能**: 限价单 + TWAP（Clockwork）
4. **透明费用**: 分级定价，清晰合理

### 与 Ethereum 版本的协同

- 统一的品牌和用户体验
- 跨链套利机会
- 共享安全最佳实践
- 多链流动性聚合

### 下一步行动

1. **技术准备**: 设置开发环境，安装依赖
2. **实施计划**: 编写详细的任务分解
3. **启动开发**: 使用 TDD 方法逐步实现
4. **持续测试**: Devnet 部署和压力测试

---

**文档版本**: 1.0
**最后更新**: 2026-01-29
**贡献者**: AI Assistant & User

---

## 附录 A: 依赖版本

```toml
[dependencies]
anchor-lang = "0.29.0"
anchor-spl = "0.29.0"
pyth-sdk-solana = "0.9.0"
clockwork-sdk = "2.0.0"

[dev-dependencies]
solana-program-test = "1.17.0"
```

## 附录 B: 有用的链接

- [Jupiter Documentation](https://docs.jup.ag/)
- [Pyth Network](https://pyth.network/)
- [Jito Labs](https://www.jito.wtf/)
- [Clockwork](https://www.clockwork.xyz/)
- [Anchor Book](https://book.anchor-lang.com/)

---

## 十一、总结

### 11.1 核心优势

| 优势         | 说明                      | 价值                       |
| ------------ | ------------------------- | -------------------------- |
| **完全链上** | 零链下依赖，无单点故障    | 最大化去中心化和抗审查性   |
| **可扩展**   | 动态添加/删除 Token       | 无需升级程序即可支持新资产 |
| **低成本**   | 80-120k CU，0.04% 协议费  | 用户交易成本最小化         |
| **多 DEX**   | Jupiter/Raydium/Orca 集成 | 灵活选择最优路由           |
| **安全**     | 完善验证 + 紧急暂停       | 保护用户资产               |
| **简单**     | ~500 行核心代码           | 易审计和维护               |

### 11.2 与原方案对比

| 维度         | 原复杂方案               | 现极简方案       | 改进          |
| ------------ | ------------------------ | ---------------- | ------------- |
| **功能范围** | 限价单 + TWAP + MEV 保护 | 仅即时交换       | ✅ 聚焦核心   |
| **依赖项**   | 5+ (Clockwork/Jito/...)  | 2 (Jupiter/Pyth) | ✅ 降低复杂度 |
| **代码行数** | ~2000+ 行                | ~500 行          | ✅ 减少 75%   |
| **CU 消耗**  | 150-250k                 | 80-120k          | ✅ 降低 40%   |
| **账户类型** | 5+ 种                    | 3 种             | ✅ 简化架构   |
| **开发时间** | 8-12 周                  | 4-5 周           | ✅ 加快 50%   |
| **审计成本** | $30-50k                  | $15-30k          | ✅ 降低成本   |
| **维护难度** | 高                       | 低               | ✅ 长期可持续 |

### 11.3 适用场景

✅ **适合**:

- 需要简单、可靠的 Token 交换
- 希望集成多个 DEX 获得最优价格
- 追求低费用和高性能
- 需要动态支持新 Token
- 重视去中心化和安全性

❌ **不适合**:

- 需要限价单、TWAP 等高级功能
- 需要复杂的 MEV 保护策略
- 追求协议收入最大化（高费率）

### 11.4 未来扩展方向

**Phase 1: 核心功能** (当前方案)

- ✅ 即时 Token 交换
- ✅ 多 DEX 支持
- ✅ 动态 Token 管理

**Phase 2: 性能优化** (3-6 个月)

- 🔄 地址查找表（LUT）集成
- 🔄 批量交换优化
- 🔄 链上路由缓存

**Phase 3: 功能增强** (6-12 个月)

- 🔄 限价单（如果用户需求强烈）
- 🔄 更多 DEX 集成（Phoenix/Meteora）
- 🔄 跨链桥接集成

**Phase 4: 生态系统** (12+ 个月)

- 🔄 治理代币
- 🔄 流动性挖矿
- 🔄 DAO 管理

### 11.5 风险评估

| 风险             | 概率 | 影响 | 缓解措施            |
| ---------------- | ---- | ---- | ------------------- |
| **Jupiter 依赖** | 中   | 高   | 支持多个 DEX 备选   |
| **智能合约漏洞** | 低   | 高   | 专业审计 + 紧急暂停 |
| **市场竞争**     | 高   | 中   | 专注差异化价值      |
| **监管风险**     | 低   | 中   | 去中心化架构        |
| **技术债务**     | 低   | 低   | 简单架构易维护      |

---

## 十二、变更日志

### v2.0 (2026-01-29) - 极简全链上重构 ✅

- ❌ 移除限价单和 TWAP 功能
- ❌ 移除 Clockwork 依赖
- ❌ 移除分级 MEV 保护
- ❌ 移除链下 Keeper 服务
- ✅ 简化为纯即时交换
- ✅ 保留多 DEX 支持
- ✅ 优化 CU 消耗到 80-120k
- ✅ 统一费率 0.04%
- ✅ 完全链上架构

### v1.0 (2026-01-29) - 初始复杂方案

- 完整的 DEX 聚合器功能
- 三级 MEV 保护
- 限价单和 TWAP 订单
- Clockwork 自动化

---

**文档版本**: 2.0 (极简全链上方案)  
**最后更新**: 2026-01-29  
**状态**: ✅ 设计完成，准备实施  
**贡献者**: AI Assistant & User
