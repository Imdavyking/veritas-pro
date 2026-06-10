// src/hooks/useMarkets.js
import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  VERITAS_ABI,
  MARKET_STATUS,
  MARKET_OUTCOME,
} from "../config/contract.js";

function getReadProvider() {
  return new ethers.JsonRpcProvider("https://dream-rpc.somnia.network");
}

function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, VERITAS_ABI, signerOrProvider);
}

function formatMarket(raw, id) {
  return {
    id,
    question: raw.question,
    resolutionSource: raw.resolutionSource,
    deadline: Number(raw.deadline),
    yesPool: ethers.formatEther(raw.yesPool),
    noPool: ethers.formatEther(raw.noPool),
    outcome: MARKET_OUTCOME[raw.outcome],
    status: MARKET_STATUS[raw.status],
    disputeDeadline: Number(raw.disputeDeadline),
    creator: raw.creator,
  };
}

export function useMarkets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = getReadProvider();
      const contract = getContract(provider);
      const count = Number(await contract.marketCount());
      const fetched = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          contract.getMarket(i).then((raw) => formatMarket(raw, i)),
        ),
      );
      setMarkets(fetched.reverse()); // newest first
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMarket = useCallback(async (id) => {
    try {
      const provider = getReadProvider();
      const contract = getContract(provider);
      const raw = await contract.getMarket(id);
      const updated = formatMarket(raw, id);
      setMarkets((prev) => prev.map((m) => (m.id === id ? updated : m)));
      return updated;
    } catch (e) {
      console.error("refreshMarket error:", e);
    }
  }, []);

  // ── Write actions ─────────────────────────────────────────

  const createMarket = useCallback(
    async (signer, question, source, deadline) => {
      const contract = getContract(signer);
      const tx = await contract.createMarket(question, source, deadline);
      await tx.wait();
      await fetchAll();
    },
    [fetchAll],
  );

  const bet = useCallback(
    async (signer, id, isYes, amountEth) => {
      const contract = getContract(signer);
      const value = ethers.parseEther(amountEth.toString());
      const tx = isYes
        ? await contract.betYes(id, { value })
        : await contract.betNo(id, { value });
      await tx.wait();
      return refreshMarket(id);
    },
    [refreshMarket],
  );

  const triggerResolution = useCallback(
    async (signer, id) => {
      const provider = getReadProvider();
      const contract = getContract(provider);
      const fee = await contract.resolutionFee();

      // ── pre-flight check ──────────────────────────────────────
      const balance = await signer.provider.getBalance(
        await signer.getAddress(),
      );
      if (balance < fee) {
        const needed = ethers.formatEther(fee);
        const have = ethers.formatEther(balance);
        throw Object.assign(new Error("INSUFFICIENT_FUNDS"), {
          code: "INSUFFICIENT_FUNDS",
          needed,
          have,
        });
      }
      // ─────────────────────────────────────────────────────────

      const writeable = getContract(signer);
      const tx = await writeable.triggerResolution(id, { value: fee });
      await tx.wait();
      return refreshMarket(id);
    },
    [refreshMarket],
  );

  const raiseDispute = useCallback(
    async (signer, id) => {
      const provider = getReadProvider();
      const contract = getContract(provider);
      const fee = await contract.disputeFee();
      // ── pre-flight check ──────────────────────────────────────
      const balance = await signer.provider.getBalance(
        await signer.getAddress(),
      );
      if (balance < fee) {
        const needed = ethers.formatEther(fee);
        const have = ethers.formatEther(balance);
        throw Object.assign(new Error("INSUFFICIENT_FUNDS"), {
          code: "INSUFFICIENT_FUNDS",
          needed,
          have,
        });
      }
      const writeable = getContract(signer);
      const tx = await writeable.raiseDispute(id, { value: fee });
      await tx.wait();
      return refreshMarket(id);
    },
    [refreshMarket],
  );

  const claimPayout = useCallback(
    async (signer, id) => {
      const contract = getContract(signer);
      const tx = await contract.claimPayout(id);
      await tx.wait();
      return refreshMarket(id);
    },
    [refreshMarket],
  );

  const getStakes = useCallback(async (id, address) => {
    const provider = getReadProvider();
    const contract = getContract(provider);
    const [yes, no] = await contract.getStakes(id, address);
    return { yes: ethers.formatEther(yes), no: ethers.formatEther(no) };
  }, []);

  return {
    markets,
    loading,
    error,
    fetchAll,
    refreshMarket,
    createMarket,
    bet,
    triggerResolution,
    raiseDispute,
    claimPayout,
    getStakes,
  };
}
