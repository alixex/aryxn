# Solidity 开发与部署指南

**版本**: 1.0  
**状态**: 开发文档  
**最后更新**: 2026-01-18

---

## 🛠️ 环境准备

在开始开发之前，确保你已经安装了以下工具：

- **Node.js**: 用于运行 JavaScript 代码和管理依赖。
- **Truffle**: 一个流行的以太坊开发框架。
- **Ganache**: 本地以太坊区块链，用于测试合约。
- **Metamask**: 浏览器扩展，用于与以太坊网络交互。

## 📦 创建项目

使用 Truffle 创建一个新的项目：

```bash
mkdir my-solidity-project
cd my-solidity-project
truffle init
```

## ✍️ 编写智能合约

在 `contracts` 文件夹中创建一个新的 Solidity 文件，例如 `MyContract.sol`，并编写你的合约代码：

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}
```

## ⚙️ 编译合约

使用以下命令编译你的合约：

```bash
truffle compile
```

## 🚀 部署合约

在 `migrations` 文件夹中创建一个新的迁移文件，例如 `2_deploy_contracts.js`，并添加以下代码：

```javascript
const MyContract = artifacts.require("MyContract")

module.exports = function (deployer) {
  deployer.deploy(MyContract, "My First Contract")
}
```

然后使用以下命令部署合约：

```bash
truffle migrate
```

## 🧪 测试合约

在 `test` 文件夹中创建一个新的测试文件，例如 `my_contract.test.js`，并编写测试代码：

```javascript
const MyContract = artifacts.require("MyContract")

contract("MyContract", () => {
  it("should set the name correctly", async () => {
    const instance = await MyContract.deployed()
    const name = await instance.name()
    assert.equal(name, "My First Contract")
  })
})
```

使用以下命令运行测试：

```bash
truffle test
```

## 🌐 部署到主网

在部署到主网之前，确保你已经配置了 `truffle-config.js` 文件，添加主网的网络配置。然后使用以下命令进行部署：

```bash
truffle migrate --network mainnet
```

## ✅ 验证合约

使用 Etherscan 或其他区块链浏览器验证你的合约，确保合约代码和 ABI 可公开访问。
