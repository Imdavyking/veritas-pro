// src/hooks/useWallet.js
import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import {
  SOMNIA_CHAIN_ID,
  SOMNIA_CHAIN_ID_HEX,
  SOMNIA_ADD_CHAIN_PARAMS,
} from "../config/contract.js";

// Normalise whatever MetaMask hands us into a plain JS number
function parseChainId(raw) {
  if (raw === null || raw === undefined) return null;
  return typeof raw === "string" && raw.startsWith("0x")
    ? parseInt(raw, 16)
    : Number(raw);
}

async function switchToSomnia() {
  // 1. Try switching — works if network is already in MetaMask
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SOMNIA_CHAIN_ID_HEX }],
    });
    return; // done
  } catch (err) {
    // 4902 = chain not known to MetaMask yet — fall through to add it
    if (err.code !== 4902) throw err;
  }

  // 2. Add the network (SOMNIA_ADD_CHAIN_PARAMS has NO extra keys)
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [SOMNIA_ADD_CHAIN_PARAMS],
  });

  // 3. Switch again — addEthereumChain doesn't guarantee auto-switch
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: SOMNIA_CHAIN_ID_HEX }],
  });
}

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const isCorrectChain = chainId === SOMNIA_CHAIN_ID;

  // Read current chainId directly from MetaMask (avoids event race conditions)
  async function readChainId() {
    const raw = await window.ethereum.request({ method: "eth_chainId" });
    return parseChainId(raw);
  }

  // Auto-reconnect if wallet was previously authorised
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) connect();
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // React to MetaMask account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccounts = (accounts) => {
      if (accounts.length === 0) disconnect();
      else setAddress(accounts[0]);
    };

    // MetaMask always sends hex in chainChanged
    const onChain = (hexId) => setChainId(parseChainId(hexId));

    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("No wallet detected. Install MetaMask.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      // 1. Request accounts
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // 2. Add Somnia network if needed, then switch to it
      await switchToSomnia();

      // 3. Build provider + signer AFTER switch (so they're on the right chain)
      const _provider = new ethers.BrowserProvider(window.ethereum);
      const _signer = await _provider.getSigner();
      const _address = await _signer.getAddress();

      // 4. Read chainId directly — don't wait for the chainChanged event
      const _chainId = await readChainId();

      setProvider(_provider);
      setSigner(_signer);
      setAddress(_address);
      setChainId(_chainId);
    } catch (e) {
      if (e.code === 4001) {
        setError("Please approve the network switch to Somnia Testnet.");
      } else {
        setError(e.message || "Connection failed");
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);

  return {
    address,
    provider,
    signer,
    chainId,
    isCorrectChain,
    connecting,
    error,
    connect,
    disconnect,
  };
}
