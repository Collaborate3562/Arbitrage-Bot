
require("dotenv").config();
const fs = require('fs');
const Web3 = require("web3");
const {validate}= require("ethers-private");
const ethers = require('ethers');
const web3_WSS = new Web3(process.env.WSS_PROVIDER);
const web3_HTTPS = new Web3(process.env.HTTPS_PROVIDER);
const { JsonRpcProvider } = require("@ethersproject/providers");
const provider = new JsonRpcProvider(process.env.HTTPS_PROVIDER);
var BigNumber = require('big-number');
let txCount;
// const { address } = web3_HTTPS.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
// const privKey = Buffer.from(pretty(process.env.PRIVATE_KEY), "hex");
// const signer = new ethers.Wallet(privKey, provider);

//ABI
const routersABI = require("./abi/routers.json");
const pairsABI = require("./abi/pairs.json");
const factoriesABI = require("./abi/factories.json");
const tokenABI = require("./abi/abi_token.json");

//setting
const setting = require("./setting/setting.json");
let stop = false;

//Address
const dex_addresses = require("./setting/dex.json");
const pair_addresses = require("./setting/pairs.json");

const {UNISWAP_ROUTER_ADDRESS, SUSHISWAP_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, ETH_USDC_PAIR_SUSHI, ETH_USDC_PAIR_UNI, UNISWAP_POOL_ABI} = require('./consts.js');
const { address } = web3_HTTPS.eth.accounts.privateKeyToAccount(validate(process.env.PRIVATE_KEY));
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.HTTPS_PROVIDER));
const uniswapRouter = new web3.eth.Contract(UNISWAP_ROUTER_ABI, UNISWAP_ROUTER_ADDRESS);
const sushiswapRouter = new web3.eth.Contract(UNISWAP_ROUTER_ABI, SUSHISWAP_ROUTER_ADDRESS);
const uniswapPair = new web3.eth.Contract(UNISWAP_POOL_ABI, ETH_USDC_PAIR_UNI);
const sushiswapPair= new web3.eth.Contract(UNISWAP_POOL_ABI, ETH_USDC_PAIR_SUSHI);
const amount = process.env.ATTACK_AMOUNT;

var tradeMode= false;

console.log("\x1b[40m")
console.log("\x1b[32m","This is script of Arbitrage Trading bot between Uniswap v2 and Sushiswap in Ethereum.")
console.log("\x1b[32m", "This used USDC, ETH pair for arbitrage tokens.")
console.log("\x1b[32m", "You can see here more detail: https://messari.io/article/arbitraging-uniswap-and-sushiswap-in-node-js")

const runBot = async () => {
  var EthBalance= await web3.eth.getBalance(address);
  console.log("\x1b[33m","===current balance of wallet===::: "+String(EthBalance/1000000000000000000)+ " Eth");
  if(EthBalance< amount*1000000000000000000){
    console.log("\x1b[31m"
,    "Insuficiant Start money, The estimated start money for now is "+ amount+ " Eth");
    console.log("\x1b[37m", "Please input more money and try again");
    return;
  }
  

  var reservesUni = await uniswapPair.methods.getReserves().call();
  var reservesSushi= await sushiswapPair.methods.getReserves().call();
  var ethPrcSushi= parseInt(reservesSushi['0'])/1000000/(parseInt(reservesSushi['1'])/1000000000000000000);
  var slippage= 0
  if(amount >=3){
    slippage= amount
  }
  else if(amount >=100){
    slippage= amount*10
  }
  else if(amount>=10){
    slippage= amount*5
  }
  else if(amount>=1000){
    slippage= amount*100
  }
  
  var outPutAm= parseInt(ethPrcSushi*amount*1000000)+process.env.gas_price*process.env.gas_limit*slippage;
  console.log("\x1b[33m", "===input amount================::: "+String(amount)+ " Eth");
  console.log("\x1b[33m", "===output amount of USDC=======::: "+String(ethPrcSushi*amount)+ " USDC");
  var outAmount = await uniswapRouter.methods.getAmountsOut(BigNumber(outPutAm), [process.env.OUT_TOKEN_ADDRESS, process.env.INPUT_TOKEN_ADDRESS]).call();
  // var ethPrcSushi= parseInt(reservesSushi['0'])/1000000/(parseInt(reservesSushi['1'])/1000000000000000000);
  var outEth= parseInt(outAmount[1]);
  console.log("\x1b[33m", "===estimate Eth after abitrage=::: "+String(outEth/1000000000000000000)+ " ETH");
  var profit= outEth/1000000000000000000- amount
  console.log("\x1b[32m", "===PROFIT======================::: "+ profit+ " ETH");
  console.log("**************************************************************");
  if(profit){
    if(!tradeMode){
      console.log("\x1b[37m", "This is not Trade mode, Please turn on trade mode and try again!");
      return;
    }
    await buyTokens(process.env.OUT_TOKEN_ADDRESS, process.env.INPUT_TOKEN_ADDRESS, amount, 20, 0, 0, 500000);
    await sleep(3000);
    await sellTokens(20, 500000);
  }
  // var input_amount = BigNumber(10 ** 18).multiply(amount).toString();
  // var amounts = await uniswapRouter.methods.getAmountsOut(BigNumber(input_amount), [process.env.INPUT_TOKEN_ADDRESS, process.env.OUT_TOKEN_ADDRESS]).call();
  // let output_amount = amounts[amounts.length - 1];
  // console.log("output_amount", output_amount);
  // var outAmount = await sushiswapRouter.methods.getAmountsOut(BigNumber(output_amount), [process.env.OUT_TOKEN_ADDRESS, process.env.INPUT_TOKEN_ADDRESS]).call();
  // console.log("outAmount", outAmount[amounts.length - 1]);
  console.log("\x1b[40m")
};
let buyTokens = async (tokenAddress,baseToken,public,value,gasPrice,maxPriorityFeePerGas,maxFeePerGas,gasLimit)=>{
  let txHash;
  try{
      console.log('|-----------------------------[buying]---------------------------');
      console.log('| gasPrice ',gasPrice)
      console.log('| gasLimit ',gasLimit)
      const amountIn = ethers.utils.parseUnits(String(value), 'ether');
      
      const router = new ethers.Contract(UNISWAP_ROUTER_ADDRESS,UNISWAP_ROUTER_ABI,signer);
      const nonce = await web3.eth.getTransactionCount(public,'pending');
      let gasTx;
      if(maxPriorityFeePerGas){
          gasTx={ 
              gasLimit: ethers.utils.hexlify(Number(gasLimit)),
              maxPriorityFeePerGas: ethers.utils.hexlify(Number(maxPriorityFeePerGas)),
              maxFeePerGas: ethers.utils.hexlify(Number(maxFeePerGas)),
              value: amountIn,
              nonce:nonce,
          }
      }else{
          gasTx={ 
              gasLimit: ethers.utils.hexlify(Number(gasLimit)),
              gasPrice: ethers.utils.hexlify(Number(gasPrice)),
              value: amountIn,
              nonce:nonce,
          }
      }
      console.log('--tx--')
      console.log(gasTx);
      const tx = await router.swapExactETHForTokens(
          '0',
          [baseToken, tokenAddress],
          public,
          Date.now() + 10000 * 60 * 10, //100 minutes
          gasTx
      );
      txHash = tx.hash;
      console.log(`|***********Buy Tx-hash: ${txHash}`);
      
  }catch(error){
      console.log('[ERROR->buyTokens]')
      console.log(error)
      return false;
  }
}
let getBalance = async (addr, publicKey) => {
  let balance = 0;
  let decimal = 0;
  let contractInstance = new web3.eth.Contract(tokenABI, addr);
  try{
      balance = await contractInstance.methods.balanceOf(publicKey).call();
  }catch(error){
      console.log(error);
      return 0;
  }
  try{
      decimal = await contractInstance.methods.decimals().call();
  }catch(error){
      console.log(error);
      return 0;
  }
  const val = balance / Math.pow(10, decimal);
  return val;
}
let approveTokens = async (gas_price, gasLimit)=>{
  try{
      console.log('~~~~~~~~~~~~~~~~~[Approve]~~~~~~~~~~~~~~~~~');
      const balanceR = await getBalance(process.env.OUT_TOKEN_ADDRESS, address);
      const amountIn = ethers.utils.parseUnits(String(balanceR), 'ether');
      const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(gas_price), "gwei")));
      const gas_Limit = ethers.utils.hexlify(Number(gasLimit));
      let contract = new ethers.Contract(process.env.OUT_TOKEN_ADDRESS, tokenABI, signer);
      let tx = await contract.approve(sushiswapRouter, amountIn, {gasLimit: gas_Limit, gasPrice: gasPrice});
      await tx.wait();
      console.log(`<<<<<------- Approved on sushiswap -------->>>>>`);
      return true;
  }catch(error){
      console.log('[ERROR->swap approve]');
      console.log(error);
      return false;
  }
}
let sellTokens = async (gasPrice, gasLimit)=>{
  try{
      console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');

      const approved = await approveTokens(gasPrice, gasLimit);
      if(approved==false){
          console.log('[Failed in sell approve]');
          return false;
      }

      const balanceR = await getBalance(process.env.OUT_TOKEN_ADDRESS, address);
      const amountIn = ethers.utils.parseUnits(String(balanceR), 'ether');
      const router = new ethers.Contract(SUSHISWAP_ROUTER_ADDRESS,UNISWAP_ROUTER_ABI,signer);
      const gas_Price = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(gasPrice), "gwei")));
      const gas_Limit = ethers.utils.hexlify(Number(gasLimit));
      const nonce = await web3.eth.getTransactionCount(address,'pending');
      //--swap token
      try{
          const amounts = await router.getAmountsOut(amountIn, [process.env.OUT_TOKEN_ADDRESS, process.env.INPUT_TOKEN_ADDRESS]);
          const amountOutMin = amounts[1].sub(amounts[1].div(10)); // slippage as 10%
          const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
              amountIn,
              amountOutMin,
              [process.env.OUT_TOKEN_ADDRESS, process.env.INPUT_TOKEN_ADDRESS],
              address,
              Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
              { gasLimit: gas_Limit, gasPrice: gas_Price,nonce:nonce,}
          );
          const txHash = tx.hash;
          console.log(`Sell Tx-hash: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
          return true;    
      }catch(error){
          console.log('[selling token failed]');
          console.log(error)
          return false;
      }
  }catch(error){
      console.log('[ERROR->sellTokens]')
      console.log(error)
      return false;
  }
}
const writeAllPairs = async () => {
  const factories = [];
  for (let i = 0; i < dex_addresses.length; i++) {//get factory and router contracts
    const factory = new web3_HTTPS.eth.Contract(
      factoriesABI[i],
      dex_addresses[i].factory
    );
    factories.push(factory);
  }
  const factory = factories[0];
  const pairABI = pairsABI;
  const allPairsLength = await factory.methods.allPairsLength().call();
  const pairSearchDepth = allPairsLength;
  let tokenList = [];
  console.log('=====> Searching pairs')
  for(let i = 0 ; i < pairSearchDepth ; i++){
    const allPairs = await factory.methods.allPairs(i).call();
    const pairContract = new web3_HTTPS.eth.Contract(pairABI,allPairs);
    const token0 = await pairContract.methods.token0().call();
    const token1 = await pairContract.methods.token1().call();
    const pairExistInOtherDex = await checkPairExist(factories,token0,token1);
    printProgress(Math.floor(1000*i/pairSearchDepth)/10);
    if(pairExistInOtherDex==false) continue;
    const ob = {
      pairAddr:allPairs,
      token0:token0,
      token1:token1,
    };
    tokenList.push(ob);
  }
  fs.writeFile ("allpairs.json", JSON.stringify(tokenList), function(err) {
    if (err) throw err;
    console.log('\nended writing-pairs');
    }
  );
}
const findTriangle = async () => {
  const allpairs = require("./allpairs.json");
  //A-B,B-C,C-A
  let abc = [];
  for(let i = 0 ; i < allpairs.length; i++){
    const pairAB = allpairs[i];
    const pairBCList = findPair(allpairs,pairAB,[pairAB.pairAddr]);
    for(let bc = 0; bc< pairBCList.length; bc++){
      const pairBC = pairBCList[bc];
      if(pairAB.token0 == pairBC.token0){
        const a = pairAB.token1, b = pairAB.token0, c = pairBC.token1;
        const pairExist = checkIfPairExist(allpairs,{token0:a,token1:c});
        if(pairExist) abc.push({token0:a,token1:b,token2:c})
      }
      else if(pairAB.token0 == pairBC.token1){
        const a = pairAB.token1, b = pairAB.token0, c = pairBC.token0;
        const pairExist = checkIfPairExist(allpairs,{token0:a,token1:c});
        if(pairExist) abc.push({token0:a,token1:b,token2:c})
      }
      else if(pairAB.token1 == pairBC.token0){
        const a = pairAB.token0, b = pairAB.token1, c = pairBC.token1;
        const pairExist = checkIfPairExist(allpairs,{token0:a,token1:c});
        if(pairExist) abc.push({token0:a,token1:b,token2:c})
      }
      else if(pairAB.token1 == pairBC.token1){
        const a = pairAB.token0, b = pairAB.token1, c = pairBC.token0;
        const pairExist = checkIfPairExist(allpairs,{token0:a,token1:c});
        if(pairExist) abc.push({token0:a,token1:b,token2:c})
      }
    }
    for(let i = 0 ; i < abc.length; i++){
      const {token0,token1,token2} = abc[i];
      const decimal0 = await new web3_HTTPS.eth.Contract(tokenABI,token0).methods.decimals().call();
      const decimal1 = await new web3_HTTPS.eth.Contract(tokenABI,token1).methods.decimals().call();
      const decimal2 = await new web3_HTTPS.eth.Contract(tokenABI,token2).methods.decimals().call();
      abc[i] = {...abc[i],decimal0,decimal1,decimal2};
    }
  }
  fs.writeFile ("./setting/pairs.json", JSON.stringify(abc), function(err) {
    if (err) throw err;
    console.log('\nended writing-pairs');
    }
  );
}
const checkPairExist = async (factories,token0,token1) => {
  for(let i = 0; i < factories.length; i++){
    try{
      const pairAddress = await factories[i].methods.getPair(token0,token1).call();
      if(pairAddress == "0x0000000000000000000000000000000000000000") return false;
    }catch(e){
      return false;
    }
  }
  return true;
}
const findPair = (tokenList,pair,pairAddrList)=>{
  const pairs = [];
  for(let i =0 ; i < tokenList.length; i++){
    const {token0,token1,pairAddr} = tokenList[i];
    if(pairAddrList.indexOf(pairAddr)==-1 && (pair.token0 == token0 || pair.token0 == token1 || pair.token1 == token0 || pair.token1 == token1)) pairs.push(tokenList[i]);
  }
  return pairs;
}
const checkIfPairExist = (tokenList,pair)=>{
  for(let i =0 ; i < tokenList.length; i++){
    const {token0,token1} = tokenList[i];
    if((pair.token0 == token0 && pair.token1 == token1) || (pair.token0 == token1 && pair.token1 == token0)) return true;
  }
  return false;
}
function printProgress(progress){
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`[===============> ${progress} % <================]`);
}

let sleep= (ms)=> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const command = process.argv.slice(2);
if(command.length==0){
  console.log("Bot started!");
  setTimeout(async ()=>{
    while(1){
      await runBot()
      await sleep(10000);
    }
},3000);
}else{
  if(command[0]=='--write'){
    console.log("Writing all pairs")
    writeAllPairs();
  }
  else if(command[0]=='--generate'){
    console.log("Finding triangle")
    findTriangle();
  }
}
