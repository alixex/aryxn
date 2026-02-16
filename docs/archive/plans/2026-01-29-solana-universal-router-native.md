# Solana Universal Router - Native 实现方案

**日期**: 2026-01-29
**状态**: 📝 从 Anchor 迁移到原生 Solana
**目标**: 构建极简、无框架依赖的全链上 Token 交换协议

---

## 执行摘要

### 技术栈变更

从 Anchor 框架迁移到原生 Solana 开发：

| 维度           | Anchor 方案             | Native 方案           | 优势            |
| -------------- | ----------------------- | --------------------- | --------------- |
| **框架**       | Anchor 0.32.1           | solana-program 3.0+   | ✅ 无版本冲突   |
| **依赖**       | anchor-lang, anchor-spl | solana-program, borsh | ✅ 最小依赖     |
| **程序大小**   | ~100-150KB              | ~60-80KB              | ✅ 减少 40%     |
| **CU 消耗**    | ~120k                   | ~80-100k              | ✅ 降低 20%     |
| **开发复杂度** | 低（宏驱动）            | 中（手动编写）        | ⚠️ 需要更多代码 |
| **部署依赖**   | 需要 Anchor CLI         | 仅需 Solana CLI       | ✅ 工具链简化   |
| **兼容性**     | 依赖 Anchor 版本        | 直接兼容 Solana       | ✅ 长期稳定     |

### 迁移决策理由

1. **消除依赖冲突**: Anchor 0.32.1 与 Solana 3.0+ 存在版本冲突
2. **性能优化**: 原生程序更小、更快
3. **未来证明**: 直接使用 Solana SDK，不受框架更新影响
4. **完全控制**: 对每个指令和账户验证有完全控制权
5. **学习价值**: 深入理解 Solana 运行时机制

---

## 一、核心架构对比

### 1.1 Anchor vs Native 代码对比

**Anchor 版本**:

```rust
#[program]
pub mod universal_router {
    pub fn initialize(ctx: Context<Initialize>, default_fee_bps: u16) -> Result<()> {
        let state = &mut ctx.accounts.router_state;
        state.authority = ctx.accounts.authority.key();
        state.default_fee_bps = default_fee_bps;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + RouterState::INIT_SPACE,
        seeds = [b"router_state"],
        bump
    )]
    pub router_state: Account<'info, RouterState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

**Native 版本**:

```rust
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use borsh::{BorshDeserialize, BorshSerialize};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = RouterInstruction::try_from_slice(instruction_data)?;

    match instruction {
        RouterInstruction::Initialize { default_fee_bps } => {
            process_initialize(program_id, accounts, default_fee_bps)
        }
        // ... other instructions
    }
}

fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    default_fee_bps: u16,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let router_state_account = next_account_info(account_iter)?;
    let authority = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // 验证 PDA
    let (expected_pda, bump) = Pubkey::find_program_address(
        &[b"router_state"],
        program_id
    );

    if router_state_account.key != &expected_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // 检查账户是否已初始化
    if router_state_account.lamports() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // 计算租金
    let rent = Rent::get()?;
    let space = 8 + std::mem::size_of::<RouterState>();
    let lamports = rent.minimum_balance(space);

    // 创建 PDA 账户
    invoke_signed(
        &system_instruction::create_account(
            authority.key,
            router_state_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            authority.clone(),
            router_state_account.clone(),
            system_program.clone(),
        ],
        &[&[b"router_state", &[bump]]],
    )?;

    // 初始化数据
    let mut router_state = RouterState {
        authority: *authority.key,
        fee_recipient: *authority.key,
        default_fee_bps,
        total_tokens: 0,
        total_volume_usd: 0,
        paused: false,
        version: 1,
        bump,
    };

    // 序列化并写入
    router_state.serialize(&mut &mut router_state_account.data.borrow_mut()[..])?;

    msg!("✅ Router initialized with fee: {} bps", default_fee_bps);

    Ok(())
}
```

### 1.2 项目结构

```
programs/universal-router/
├── Cargo.toml
└── src/
    ├── lib.rs              // 程序入口
    ├── entrypoint.rs       // 指令分发
    ├── processor.rs        // 核心处理逻辑
    ├── instruction.rs      // 指令定义
    ├── state.rs            // 状态账户结构
    ├── error.rs            // 自定义错误
    ├── utils.rs            // 辅助函数
    └── dex/
        ├── mod.rs
        ├── jupiter.rs      // Jupiter 集成
        ├── raydium.rs      // Raydium 集成
        └── orca.rs         // Orca 集成
```

---

## 二、数据结构（Native 实现）

### 2.1 指令定义

```rust
// src/instruction.rs
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum RouterInstruction {
    /// 初始化路由器
    ///
    /// Accounts:
    /// 0. `[writable, signer]` authority - 管理员钱包
    /// 1. `[writable]` router_state - 路由器状态账户 (PDA)
    /// 2. `[]` system_program - System program
    Initialize {
        default_fee_bps: u16,
    },

    /// 添加 Token
    ///
    /// Accounts:
    /// 0. `[signer]` authority
    /// 1. `[writable]` router_state
    /// 2. `[writable]` token_config - Token 配置账户 (PDA)
    /// 3. `[]` token_mint - Token Mint 账户
    /// 4. `[]` system_program
    AddToken {
        custom_fee_bps: u16,
        pyth_price_feed: Option<Pubkey>,
    },

    /// 切换 Token 状态
    ///
    /// Accounts:
    /// 0. `[signer]` authority
    /// 1. `[]` router_state
    /// 2. `[writable]` token_config
    ToggleToken {
        enabled: bool,
    },

    /// 删除 Token (关闭账户)
    ///
    /// Accounts:
    /// 0. `[signer]` authority
    /// 1. `[writable]` router_state
    /// 2. `[writable]` token_config
    RemoveToken,

    /// 添加 DEX
    AddDex {
        dex_id: String,
        program_id: Pubkey,
        dex_type: DexType,
    },

    /// 切换 DEX 状态
    ToggleDex {
        enabled: bool,
    },

    /// 删除 DEX
    RemoveDex,

    /// 执行交换
    ///
    /// Accounts:
    /// 0. `[]` router_state
    /// 1. `[]` token_in_config
    /// 2. `[]` token_out_config
    /// 3. `[signer]` user
    /// 4. `[writable]` user_token_in
    /// 5. `[writable]` user_token_out
    /// 6. `[]` token_in_mint
    /// 7. `[]` token_out_mint
    /// 8. `[writable]` fee_vault
    /// 9. `[]` token_program
    /// 10. `[]` dex_program
    /// 11+ `[]` remaining_accounts - DEX 特定账户
    Swap {
        amount_in: u64,
        minimum_amount_out: u64,
        dex_type: DexType,
    },

    /// 提取费用
    WithdrawFees {
        amount: u64,
    },

    /// 暂停路由器
    Pause,

    /// 恢复路由器
    Unpause,

    /// 转移管理权
    TransferAuthority {
        new_authority: Pubkey,
    },
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq)]
#[repr(u8)]
pub enum DexType {
    Jupiter = 0,
    Raydium = 1,
    Orca = 2,
    Phoenix = 3,
    Meteora = 4,
    Custom = 5,
}
```

### 2.2 状态账户结构

```rust
// src/state.rs
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

/// 路由器全局状态
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct RouterState {
    pub authority: Pubkey,              // 32 bytes
    pub fee_recipient: Pubkey,          // 32 bytes
    pub default_fee_bps: u16,           // 2 bytes
    pub total_tokens: u16,              // 2 bytes
    pub total_volume_usd: u64,          // 8 bytes
    pub paused: bool,                   // 1 byte
    pub version: u8,                    // 1 byte
    pub bump: u8,                       // 1 byte
}

impl RouterState {
    pub const LEN: usize = 32 + 32 + 2 + 2 + 8 + 1 + 1 + 1;

    pub fn is_authority(&self, key: &Pubkey) -> bool {
        &self.authority == key
    }

    pub fn require_not_paused(&self) -> Result<(), ProgramError> {
        if self.paused {
            return Err(RouterError::Paused.into());
        }
        Ok(())
    }
}

/// Token 配置
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct TokenConfig {
    pub mint: Pubkey,                   // 32 bytes
    pub enabled: bool,                  // 1 byte
    pub custom_fee_bps: u16,            // 2 bytes
    pub pyth_price_feed: Option<Pubkey>, // 33 bytes (1 + 32)
    pub volume: u64,                    // 8 bytes
    pub fees_collected: u64,            // 8 bytes
    pub last_updated: i64,              // 8 bytes
    pub bump: u8,                       // 1 byte
}

impl TokenConfig {
    pub const LEN: usize = 32 + 1 + 2 + 33 + 8 + 8 + 8 + 1;

    pub fn require_enabled(&self) -> Result<(), ProgramError> {
        if !self.enabled {
            return Err(RouterError::TokenDisabled.into());
        }
        Ok(())
    }

    pub fn get_effective_fee(&self, default_fee: u16) -> u16 {
        if self.custom_fee_bps > 0 {
            self.custom_fee_bps
        } else {
            default_fee
        }
    }
}

/// DEX 配置
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct DexConfig {
    pub dex_id: String,                 // 4 + max_len bytes
    pub program_id: Pubkey,             // 32 bytes
    pub enabled: bool,                  // 1 byte
    pub dex_type: DexType,              // 1 byte
    pub total_swaps: u64,               // 8 bytes
    pub total_volume: u64,              // 8 bytes
    pub last_updated: i64,              // 8 bytes
    pub bump: u8,                       // 1 byte
}

impl DexConfig {
    pub const MAX_DEX_ID_LEN: usize = 32;
    pub const LEN: usize = 4 + Self::MAX_DEX_ID_LEN + 32 + 1 + 1 + 8 + 8 + 8 + 1;
}
```

### 2.3 错误定义

```rust
// src/error.rs
use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone, PartialEq)]
#[repr(u32)]
pub enum RouterError {
    #[error("Program is paused")]
    Paused = 0,

    #[error("Unauthorized: caller is not the authority")]
    Unauthorized = 1,

    #[error("Fee too high: maximum 1% (100 bps)")]
    FeeTooHigh = 2,

    #[error("Invalid amount: must be greater than 0")]
    InvalidAmount = 3,

    #[error("Token is disabled")]
    TokenDisabled = 4,

    #[error("Token not supported")]
    TokenNotSupported = 5,

    #[error("Insufficient amount after fee deduction")]
    InsufficientAmount = 6,

    #[error("Insufficient balance in fee vault")]
    InsufficientBalance = 7,

    ##[error("Slippage too high: output below minimum")]
    SlippageTooHigh = 8,

    #[error("Invalid output amount")]
    InvalidOutput = 9,

    #[error("Math overflow")]
    Overflow = 10,

    #[error("Math underflow")]
    Underflow = 11,

    #[error("Division by zero")]
    DivisionByZero = 12,

    #[error("Invalid mint address")]
    InvalidMint = 13,

    #[error("Invalid token account owner")]
    InvalidOwner = 14,

    #[error("Invalid DEX program")]
    InvalidDexProgram = 15,

    #[error("Invalid recipient address")]
    InvalidRecipient = 16,

    #[error("Invalid PDA")]
    InvalidPDA = 17,

    #[error("Account already initialized")]
    AccountAlreadyInitialized = 18,

    #[error("DEX ID too long (max 32 characters)")]
    DexIdTooLong = 19,
}

impl From<RouterError> for ProgramError {
    fn from(e: RouterError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

---

## 三、核心处理逻辑

### 3.1 程序入口

```rust
// src/lib.rs
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

pub mod entrypoint;
pub mod processor;
pub mod instruction;
pub mod state;
pub mod error;
pub mod utils;
pub mod dex;

use crate::processor::Processor;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    Processor::process(program_id, accounts, instruction_data)
}

// 声明程序 ID
solana_program::declare_id!("UnivXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
```

### 3.2 指令处理器

```rust
// src/processor.rs
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};
use borsh::BorshDeserialize;

use crate::instruction::RouterInstruction;

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = RouterInstruction::try_from_slice(instruction_data)?;

        match instruction {
            RouterInstruction::Initialize { default_fee_bps } => {
                Self::process_initialize(program_id, accounts, default_fee_bps)
            }
            RouterInstruction::AddToken { custom_fee_bps, pyth_price_feed } => {
                Self::process_add_token(program_id, accounts, custom_fee_bps, pyth_price_feed)
            }
            RouterInstruction::ToggleToken { enabled } => {
                Self::process_toggle_token(program_id, accounts, enabled)
            }
            RouterInstruction::RemoveToken => {
                Self::process_remove_token(program_id, accounts)
            }
            RouterInstruction::AddDex { dex_id, program_id: dex_program_id, dex_type } => {
                Self::process_add_dex(program_id, accounts, dex_id, dex_program_id, dex_type)
            }
            RouterInstruction::ToggleDex { enabled } => {
                Self::process_toggle_dex(program_id, accounts, enabled)
            }
            RouterInstruction::RemoveDex => {
                Self::process_remove_dex(program_id, accounts)
            }
            RouterInstruction::Swap { amount_in, minimum_amount_out, dex_type } => {
                Self::process_swap(program_id, accounts, amount_in, minimum_amount_out, dex_type)
            }
            RouterInstruction::WithdrawFees { amount } => {
                Self::process_withdraw_fees(program_id, accounts, amount)
            }
            RouterInstruction::Pause => {
                Self::process_pause(program_id, accounts)
            }
            RouterInstruction::Unpause => {
                Self::process_unpause(program_id, accounts)
            }
            RouterInstruction::TransferAuthority { new_authority } => {
                Self::process_transfer_authority(program_id, accounts, new_authority)
            }
        }
    }

    // 各个处理函数的实现...
}
```

---

## 四、Cargo.toml 配置

```toml
[package]
name = "universal-router"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]

[dependencies]
solana-program = "2.3"
borsh = "1.5"
thiserror = "2.0"
spl-token = "6.0"

[dev-dependencies]
solana-program-test = "2.3"
solana-sdk = "2.3"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
```

---

## 五、构建和部署

### 5.1 构建命令

```bash
# 确保 Solana 在 PATH 中
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 构建程序
cargo build-sbf --manifest-path=programs/universal-router/Cargo.toml

# 输出位置
# target/deploy/universal_router.so
```

### 5.2 部署流程

```bash
# 1. 生成密钥对 (首次)
solana-keygen new -o target/deploy/universal_router-keypair.json

# 2. 获取程序 ID
solana address -k target/deploy/universal_router-keypair.json

# 3. 更新 lib.rs 中的 declare_id!

# 4. 重新构建
cargo build-sbf

# 5. 部署到 Devnet
solana program deploy \
    --program-id target/deploy/universal_router-keypair.json \
    target/deploy/universal_router.so \
    --url devnet

# 6. 验证部署
solana program show <PROGRAM_ID> --url devnet
```

---

## 六、迁移计划

### Phase 1: 基础设施 (Week 1)

- [ ] 设置 Native Solana 项目结构
- [ ] 实现基础 entrypoint 和 processor
- [ ] 定义所有指令和状态结构
- [ ] 实现错误处理
- [ ] 编写辅助工具函数

### Phase 2: 核心功能 (Week 2)

- [ ] 实现 Initialize 指令
- [ ] 实现 Token 管理指令 (Add/Toggle/Remove)
- [ ] 实现 DEX 管理指令
- [ ] 添加 PDA 验证辅助函数

### Phase 3: 交换逻辑 (Week 3)

- [ ] 实现核心 Swap 指令
- [ ] 费用计算和收取
- [ ] 统计数据更新
- [ ] 余额验证

### Phase 4: DEX 集成 (Week 4-5)

- [ ] Jupiter CPI 集成
- [ ] Raydium CPI 集成
- [ ] Orca CPI 集成

### Phase 5: 测试 (Week 5-6)

- [ ] 单元测试
- [ ] 集成测试
- [ ] 安全测试

### Phase 6: 部署 (Week 7)

- [ ] Devnet 部署
- [ ] 审计准备
- [ ] 文档完善

---

## 七、总结

### 优势

- ✅ 完全控制，无框架限制
- ✅ 更小的程序体积
- ✅ 更低的 CU 消耗
- ✅ 与最新 Solana 版本兼容
- ✅ 无依赖版本冲突

### 挑战

- ⚠️ 更多样板代码
- ⚠️ 需要手动账户验证
- ⚠️ 开发周期稍长

### 建议

原生 Solana 开发适合：

- 需要最大性能优化
- 追求最小依赖
- 长期维护的项目
- 学习 Solana 底层机制

---

**文档版本**: 3.0 (Native Solana)
**最后更新**: 2026-01-29
**状态**: ✅ 设计完成，待实施
