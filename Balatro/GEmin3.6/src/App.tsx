import React, { useState, useEffect } from 'react';
import { BackgroundShader } from './components/BackgroundShader';
import { PlayingCard } from './components/PlayingCard';
import { JokerCard } from './components/JokerCard';
import { ScoreBoard } from './components/ScoreBoard';
import { ShopView } from './components/ShopView';
import { DeckViewModal } from './components/DeckViewModal';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';

import {
  type CardData,
  createStandardDeck,
} from './engine/cardDefs';
import {
  evaluatePokerHand,
  type PokerHandType,
} from './engine/pokerEvaluator';
import {
  type JokerData,
  createJokerInstance,
  JOKER_DEFINITIONS,
} from './engine/jokerDefs';
import {
  type ConsumableData,
  createPlanetConsumable,
  createTarotConsumable,
  PLANET_CARDS,
  TAROT_CARDS,
} from './engine/tarotDefs';
import {
  type BlindType,
  type BossBlindDef,
  getBlindScoreRequirement,
  getRandomBossBlind,
} from './engine/blindDefs';
import { soundEngine } from './audio/soundEngine';

export const App: React.FC = () => {
  // Game Setup & Mode
  const [gamePhase, setGamePhase] = useState<'title' | 'playing' | 'scoring' | 'shop' | 'gameover'>('title');
  const [ante, setAnte] = useState<number>(1);
  const [blindType, setBlindType] = useState<BlindType>('small');
  const [bossBlind, setBossBlind] = useState<BossBlindDef>(getRandomBossBlind(1));

  // Settings
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [showDeckModal, setShowDeckModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Deck & Hand
  const [fullDeck, setFullDeck] = useState<CardData[]>([]);
  const [handCards, setHandCards] = useState<CardData[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [scoringCardIds, setScoringCardIds] = useState<string[]>([]);

  // Player Inventory & Stats
  const [money, setMoney] = useState<number>(10);
  const [handsLeft, setHandsLeft] = useState<number>(4);
  const [discardsLeft, setDiscardsLeft] = useState<number>(3);
  const [roundScore, setRoundScore] = useState<number>(0);
  const [targetScore, setTargetScore] = useState<number>(300);

  // Hand Levels
  const [handLevels, setHandLevels] = useState<Record<PokerHandType, number>>({
    'High Card': 1, 'Pair': 1, 'Two Pair': 1, 'Three of a Kind': 1,
    'Straight': 1, 'Flush': 1, 'Full House': 1, 'Four of a Kind': 1,
    'Straight Flush': 1, 'Royal Flush': 1, 'Five of a Kind': 1,
    'Flush House': 1, 'Flush Five': 1,
  });

  // Jokers & Consumables
  const [userJokers, setUserJokers] = useState<JokerData[]>([]);
  const [userConsumables, setUserConsumables] = useState<ConsumableData[]>([]);

  // Scoring Animation State
  const [currentChips, setCurrentChips] = useState<number>(0);
  const [currentMult, setCurrentMult] = useState<number>(0);
  const [evaluatedHandName, setEvaluatedHandName] = useState<PokerHandType>('High Card');
  const [triggeredJokerId, setTriggeredJokerId] = useState<string | null>(null);
  const [jokerTriggerMsg, setJokerTriggerMsg] = useState<string | null>(null);

  // Shop State
  const [shopJokers, setShopJokers] = useState<JokerData[]>([]);
  const [shopConsumables, setShopConsumables] = useState<ConsumableData[]>([]);
  const [rerollCost, setRerollCost] = useState<number>(5);

  // Start New Run
  const startNewRun = () => {
    setAnte(1);
    setBlindType('small');
    setMoney(10);
    setUserJokers([createJokerInstance('j_joker')]);
    setUserConsumables([]);
    setHandLevels({
      'High Card': 1, 'Pair': 1, 'Two Pair': 1, 'Three of a Kind': 1,
      'Straight': 1, 'Flush': 1, 'Full House': 1, 'Four of a Kind': 1,
      'Straight Flush': 1, 'Royal Flush': 1, 'Five of a Kind': 1,
      'Flush House': 1, 'Flush Five': 1,
    });
    startRound(1, 'small');
  };

  // Start Round
  const startRound = (currentAnte: number, bType: BlindType) => {
    const boss = getRandomBossBlind(currentAnte);
    setBossBlind(boss);
    const req = getBlindScoreRequirement(currentAnte, bType, boss.id);
    setTargetScore(req);
    setRoundScore(0);

    // Initial hands & discards
    let h = 4;
    let d = 3;
    if (bType === 'boss' && boss.id === 'the_water') {
      d = 0;
    }
    setHandsLeft(h);
    setDiscardsLeft(d);

    // Prepare fresh deck
    const deck = shuffle([...createStandardDeck()]);

    // Apply Boss Blind debuffs to deck if applicable
    if (bType === 'boss') {
      deck.forEach(c => {
        if (boss.id === 'the_goad' && c.suit === 'spades') c.isDebuffed = true;
        if (boss.id === 'the_window' && c.suit === 'diamonds') c.isDebuffed = true;
        if (boss.id === 'the_club' && c.suit === 'clubs') c.isDebuffed = true;
        if (boss.id === 'the_head' && c.suit === 'hearts') c.isDebuffed = true;
        if (boss.id === 'the_wheel' && Math.random() < 0.15) c.isFlipped = true;
      });
    }

    // Deal 8 cards to hand
    const initialHand = deck.slice(0, 8);
    const remainingDeck = deck.slice(8);

    setHandCards(initialHand);
    setFullDeck(remainingDeck);
    setSelectedCardIds([]);
    setGamePhase('playing');
  };

  // Fisher-Yates Shuffle
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Toggle card selection
  const handleToggleSelectCard = (id: string) => {
    if (gamePhase !== 'playing') return;
    if (selectedCardIds.includes(id)) {
      setSelectedCardIds(selectedCardIds.filter((cId) => cId !== id));
    } else {
      if (selectedCardIds.length < 5) {
        setSelectedCardIds([...selectedCardIds, id]);
      }
    }
  };

  // Update live preview of poker hand when card selection changes
  useEffect(() => {
    if (gamePhase === 'playing') {
      const selectedCards = handCards.filter((c) => selectedCardIds.includes(c.id));
      const evalRes = evaluatePokerHand(selectedCards, handLevels);
      setEvaluatedHandName(evalRes.handType);
      setCurrentChips(evalRes.baseChips);
      setCurrentMult(evalRes.baseMult);
    }
  }, [selectedCardIds, handCards, gamePhase, handLevels]);

  // Discard Selected Cards
  const handleDiscard = () => {
    if (discardsLeft <= 0 || selectedCardIds.length === 0 || gamePhase !== 'playing') return;

    soundEngine.playCardDraw();
    const remainingHand = handCards.filter((c) => !selectedCardIds.includes(c.id));
    const drawCount = Math.min(fullDeck.length, 8 - remainingHand.length);
    const drawnCards = fullDeck.slice(0, drawCount);
    const newDeck = fullDeck.slice(drawCount);

    setHandCards([...remainingHand, ...drawnCards]);
    setFullDeck(newDeck);
    setSelectedCardIds([]);
    setDiscardsLeft(discardsLeft - 1);
  };

  // Play Selected Cards -> Initiate Scoring Sequence
  const handlePlayHand = async () => {
    if (handsLeft <= 0 || selectedCardIds.length === 0 || gamePhase !== 'playing') return;

    // Boss Blind constraint check
    if (blindType === 'boss' && bossBlind.id === 'the_psychic' && selectedCardIds.length !== 5) {
      alert('The Psychic requires playing exactly 5 cards!');
      return;
    }

    setGamePhase('scoring');
    setHandsLeft(handsLeft - 1);

    const playedCards = handCards.filter((c) => selectedCardIds.includes(c.id));
    const evalRes = evaluatePokerHand(playedCards, handLevels);

    setEvaluatedHandName(evalRes.handType);
    let chips = evalRes.baseChips;
    let mult = evalRes.baseMult;

    setCurrentChips(chips);
    setCurrentMult(mult);

    const stepDelay = Math.max(100, 400 / gameSpeed);

    // 1. Scoring Cards step-by-step
    const scoringCards = evalRes.scoringCards.filter((c) => !c.isDebuffed);
    setScoringCardIds(scoringCards.map((c) => c.id));

    let stepIndex = 0;
    for (const card of scoringCards) {
      soundEngine.playChipTally(stepIndex++);

      // Rank chips
      chips += card.rank <= 10 ? card.rank : card.rank === 14 ? 11 : 10;

      // Enhancements
      if (card.enhancement === 'bonus') chips += 30;
      if (card.enhancement === 'mult') mult += 4;
      if (card.enhancement === 'stone') chips += 50;
      if (card.enhancement === 'glass') mult *= 2;
      if (card.enhancement === 'steel') mult *= 1.5;

      // Editions
      if (card.edition === 'foil') chips += 50;
      if (card.edition === 'holographic') mult += 10;
      if (card.edition === 'polychrome') mult *= 1.5;

      // Seals
      if (card.seal === 'gold') setMoney((prev) => prev + 3);

      // Jokers trigger onCardScored
      for (let jIdx = 0; jIdx < userJokers.length; jIdx++) {
        const joker = userJokers[jIdx];
        const def = JOKER_DEFINITIONS[joker.defId];
        if (def && def.onCardScored) {
          const effect = def.onCardScored({
            card,
            playedCards,
            scoringCards: evalRes.scoringCards,
            cardsInHand: handCards.filter((c) => !selectedCardIds.includes(c.id)),
            handType: evalRes.handType,
            discardsLeft,
            handsLeft,
            allJokers: userJokers,
            jokerIndex: jIdx,
          });

          if (effect) {
            soundEngine.playJokerTrigger();
            setTriggeredJokerId(joker.id);
            setJokerTriggerMsg(effect.message);

            if (effect.addChips) chips += effect.addChips;
            if (effect.addMult) mult += effect.addMult;
            if (effect.multMultiplier) mult *= effect.multMultiplier;

            await new Promise((r) => setTimeout(r, stepDelay));
            setTriggeredJokerId(null);
            setJokerTriggerMsg(null);
          }
        }
      }

      setCurrentChips(Math.floor(chips));
      setCurrentMult(Math.floor(mult));
      await new Promise((r) => setTimeout(r, stepDelay));
    }

    // 2. Jokers trigger onHandPlayed (left-to-right)
    for (let jIdx = 0; jIdx < userJokers.length; jIdx++) {
      const joker = userJokers[jIdx];
      const def = JOKER_DEFINITIONS[joker.defId];
      if (def && def.onHandPlayed) {
        const effect = def.onHandPlayed({
          playedCards,
          scoringCards: evalRes.scoringCards,
          cardsInHand: handCards.filter((c) => !selectedCardIds.includes(c.id)),
          handType: evalRes.handType,
          discardsLeft,
          handsLeft,
          allJokers: userJokers,
          jokerIndex: jIdx,
        });

        if (effect) {
          soundEngine.playMultFlame();
          setTriggeredJokerId(joker.id);
          setJokerTriggerMsg(effect.message);

          if (effect.addChips) chips += effect.addChips;
          if (effect.addMult) mult += effect.addMult;
          if (effect.multMultiplier) mult *= effect.multMultiplier;

          setCurrentChips(Math.floor(chips));
          setCurrentMult(Math.floor(mult));

          await new Promise((r) => setTimeout(r, stepDelay * 1.2));
          setTriggeredJokerId(null);
          setJokerTriggerMsg(null);
        }
      }
    }

    // Final Hand Score Total
    const handScoreTotal = Math.floor(chips * mult);
    const newRoundScore = roundScore + handScoreTotal;
    setRoundScore(newRoundScore);

    // Remove played cards & refill hand
    const remainingHand = handCards.filter((c) => !selectedCardIds.includes(c.id));
    const drawCount = Math.min(fullDeck.length, 8 - remainingHand.length);
    const drawnCards = fullDeck.slice(0, drawCount);
    const newDeck = fullDeck.slice(drawCount);

    setHandCards([...remainingHand, ...drawnCards]);
    setFullDeck(newDeck);
    setSelectedCardIds([]);
    setScoringCardIds([]);

    // Boss Hook trigger
    if (blindType === 'boss' && bossBlind.id === 'the_hook' && remainingHand.length >= 2) {
      setHandCards((prev) => prev.slice(2));
    }

    // Check Round Outcome
    if (newRoundScore >= targetScore) {
      // Clear Blind Victory!
      soundEngine.playRoundWin();
      const bonusMoney = 5 + handsLeft + discardsLeft;
      setMoney((prev) => prev + bonusMoney);

      // Transition to Shop
      generateShopItems();
      setGamePhase('shop');
    } else if (handsLeft - 1 <= 0) {
      // Game Over
      soundEngine.playRoundLose();
      setGamePhase('gameover');
    } else {
      setGamePhase('playing');
    }
  };

  // Generate Shop Stock
  const generateShopItems = () => {
    const jokerKeys = Object.keys(JOKER_DEFINITIONS);
    const shuffledJokers = shuffle(jokerKeys);
    const newShopJokers = shuffledJokers.slice(0, 3).map((key) => createJokerInstance(key));

    const planetKeys = Object.keys(PLANET_CARDS);
    const tarotKeys = Object.keys(TAROT_CARDS);
    const newShopConsumables = [
      createPlanetConsumable(shuffle(planetKeys)[0]),
      createTarotConsumable(shuffle(tarotKeys)[0]),
    ];

    setShopJokers(newShopJokers);
    setShopConsumables(newShopConsumables);
    setRerollCost(5);
  };

  // Buy Joker
  const handleBuyJoker = (joker: JokerData) => {
    if (money >= joker.cost && userJokers.length < 5) {
      soundEngine.playBuy();
      setMoney((prev) => prev - joker.cost);
      setUserJokers([...userJokers, joker]);
      setShopJokers((prev) => prev.filter((j) => j.id !== joker.id));
    }
  };

  // Buy Consumable
  const handleBuyConsumable = (item: ConsumableData) => {
    if (money >= item.cost && userConsumables.length < 2) {
      soundEngine.playBuy();
      setMoney((prev) => prev - item.cost);

      if (item.type === 'Planet' && item.targetHand) {
        // Upgrade hand level immediately
        const tHand = item.targetHand;
        setHandLevels((prev) => ({ ...prev, [tHand]: (prev[tHand] || 1) + 1 }));
        soundEngine.playMagic();
      } else {
        setUserConsumables([...userConsumables, item]);
      }
      setShopConsumables((prev) => prev.filter((c) => c.id !== item.id));
    }
  };

  // Reroll Shop
  const handleRerollShop = () => {
    if (money >= rerollCost) {
      soundEngine.playReroll();
      setMoney((prev) => prev - rerollCost);
      generateShopItems();
      setRerollCost((prev) => prev + 1);
    }
  };

  // Sell Joker
  const handleSellJoker = (jokerId: string) => {
    const joker = userJokers.find((j) => j.id === jokerId);
    if (joker) {
      soundEngine.playBuy();
      setMoney((prev) => prev + joker.sellValue);
      setUserJokers(userJokers.filter((j) => j.id !== jokerId));
    }
  };

  // Advance to Next Blind / Ante
  const handleNextBlind = () => {
    if (blindType === 'small') {
      setBlindType('big');
      startRound(ante, 'big');
    } else if (blindType === 'big') {
      setBlindType('boss');
      startRound(ante, 'boss');
    } else {
      // Completed Boss Blind -> Advance Ante!
      if (ante >= 8) {
        setGamePhase('gameover');
      } else {
        const nextAnte = ante + 1;
        setAnte(nextAnte);
        setBlindType('small');
        startRound(nextAnte, 'small');
      }
    }
  };

  // Use Consumable Card in hand
  const handleUseConsumable = (item: ConsumableData) => {
    soundEngine.playMagic();
    if (item.type === 'Planet' && item.targetHand) {
      const tHand = item.targetHand;
      setHandLevels((prev) => ({ ...prev, [tHand]: (prev[tHand] || 1) + 1 }));
    } else if (item.type === 'Tarot') {
      if (item.defId === 'the_hermit') {
        setMoney((prev) => prev + Math.min(20, prev));
      } else if (item.defId === 'temperance') {
        const totalSell = userJokers.reduce((acc, j) => acc + j.sellValue, 0);
        setMoney((prev) => prev + Math.min(50, totalSell));
      } else if (item.defId === 'judgement') {
        if (userJokers.length < 5) {
          const keys = Object.keys(JOKER_DEFINITIONS);
          setUserJokers([...userJokers, createJokerInstance(shuffle(keys)[0])]);
        }
      } else if (['the_empress', 'the_hierophant', 'the_magician', 'the_chariot', 'justice'].includes(item.defId)) {
        // Enhance selected cards in hand
        if (selectedCardIds.length > 0) {
          setHandCards((prev) =>
            prev.map((c) => {
              if (selectedCardIds.includes(c.id)) {
                let enh = c.enhancement;
                if (item.defId === 'the_empress') enh = 'mult';
                if (item.defId === 'the_hierophant') enh = 'bonus';
                if (item.defId === 'the_magician') enh = 'lucky';
                if (item.defId === 'the_chariot') enh = 'steel';
                if (item.defId === 'justice') enh = 'glass';
                return { ...c, enhancement: enh };
              }
              return c;
            })
          );
        }
      }
    }
    setUserConsumables((prev) => prev.filter((c) => c.id !== item.id));
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col font-sans overflow-hidden select-none">
      {/* Background WebGL Liquid Shader & Scanlines */}
      <BackgroundShader mode={gamePhase === 'shop' ? 'shop' : blindType} crtEnabled={crtEnabled} />

      {/* TITLE SCREEN */}
      {gamePhase === 'title' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="animate-bounce mb-4 text-7xl">🎴</div>
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-red-500 to-indigo-400 drop-shadow-2xl mb-2">
            BALATRO
          </h1>
          <p className="text-lg md:text-xl text-amber-200 font-semibold mb-8 tracking-wide drop-shadow">
            WEB EDITION • POKER DECKBUILDER
          </p>

          <button
            onClick={startNewRun}
            className="px-10 py-5 bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 hover:scale-105 text-slate-950 font-extrabold text-2xl rounded-2xl border-4 border-yellow-200 shadow-2xl transition-all active:scale-95 cursor-pointer"
          >
            PLAY RUN 🃏
          </button>

          <div className="mt-12 flex gap-4">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-5 py-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-gray-300 shadow cursor-pointer"
            >
              ⚙️ SETTINGS
            </button>
          </div>
        </div>
      )}

      {/* GAMEPLAY VIEW */}
      {(gamePhase === 'playing' || gamePhase === 'scoring') && (
        <div className="relative z-10 flex-1 flex flex-col justify-between">
          {/* Top ScoreBoard */}
          <ScoreBoard
            ante={ante}
            blindType={blindType}
            bossBlind={bossBlind}
            targetScore={targetScore}
            currentRoundScore={roundScore}
            handsLeft={handsLeft}
            discardsLeft={discardsLeft}
            money={money}
            handName={evaluatedHandName}
            handLevel={handLevels[evaluatedHandName] || 1}
            currentChips={currentChips}
            currentMult={currentMult}
            isScoring={gamePhase === 'scoring'}
          />

          {/* Middle Section: Jokers & Consumables Bar */}
          <div className="max-w-6xl w-full mx-auto px-4 py-2 flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Jokers Slot Bar (5 slots max) */}
            <div className="flex items-center gap-2 bg-slate-950/70 border-2 border-slate-800 p-2 rounded-2xl backdrop-blur-md shadow-xl">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-1">
                JOKERS ({userJokers.length}/5)
              </span>
              <div className="flex gap-2 min-h-[120px] items-center">
                {userJokers.map((joker) => (
                  <JokerCard
                    key={joker.id}
                    joker={joker}
                    isTriggered={triggeredJokerId === joker.id}
                    triggerMessage={jokerTriggerMsg}
                    onSell={() => handleSellJoker(joker.id)}
                  />
                ))}
                {Array.from({ length: Math.max(0, 5 - userJokers.length) }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-24 h-36 md:w-28 md:h-40 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-700 text-2xl font-bold"
                  >
                    +
                  </div>
                ))}
              </div>
            </div>

            {/* Consumables (Tarots & Planets) */}
            {userConsumables.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-950/70 border-2 border-slate-800 p-2 rounded-2xl backdrop-blur-md shadow-xl">
                <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider px-1">
                  CONSUMABLES
                </span>
                <div className="flex gap-2">
                  {userConsumables.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleUseConsumable(item)}
                      style={{ background: item.bgGradient }}
                      className="w-20 h-28 rounded-lg border border-purple-300 p-1 flex flex-col justify-between items-center text-center cursor-pointer shadow-lg hover:scale-105 transition-transform"
                      title="Click to use!"
                    >
                      <span className="text-2xl">{item.iconSymbol}</span>
                      <span className="text-[9px] font-extrabold text-white leading-tight">{item.name}</span>
                      <span className="bg-purple-900/90 text-[8px] text-purple-200 px-1 rounded uppercase">USE</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Played Cards Scoring Slot */}
          <div className="h-28 my-auto flex items-center justify-center gap-2 px-4">
            {selectedCardIds.length === 0 ? (
              <span className="text-gray-400 text-sm font-semibold italic bg-slate-950/60 px-4 py-2 rounded-full border border-slate-800 backdrop-blur-sm">
                Select up to 5 cards to play or discard
              </span>
            ) : (
              handCards
                .filter((c) => selectedCardIds.includes(c.id))
                .map((card) => (
                  <PlayingCard
                    key={card.id}
                    card={card}
                    isSelected={true}
                    isScoring={scoringCardIds.includes(card.id)}
                    small={true}
                    disabled={gamePhase === 'scoring'}
                  />
                ))
            )}
          </div>

          {/* Bottom Controls & Hand Cards */}
          <div className="bg-slate-950/90 border-t-2 border-slate-800 p-3 backdrop-blur-md flex flex-col items-center gap-3">
            {/* Hand Cards Fan */}
            <div className="flex flex-wrap justify-center gap-2 max-w-5xl px-2">
              {handCards.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  isSelected={selectedCardIds.includes(card.id)}
                  onClick={() => handleToggleSelectCard(card.id)}
                  disabled={gamePhase === 'scoring'}
                />
              ))}
            </div>

            {/* Play / Discard / Deck Controls */}
            <div className="flex items-center gap-4 w-full max-w-xl justify-between">
              <button
                onClick={() => setShowDeckModal(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-amber-300 shadow cursor-pointer"
              >
                🎴 DECK ({fullDeck.length})
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDiscard}
                  disabled={discardsLeft <= 0 || selectedCardIds.length === 0 || gamePhase === 'scoring'}
                  className={`px-6 py-3 rounded-xl border-2 font-extrabold text-sm shadow-xl transition-all ${
                    discardsLeft <= 0 || selectedCardIds.length === 0 || gamePhase === 'scoring'
                      ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-red-700 hover:bg-red-600 border-red-400 text-white active:scale-95 cursor-pointer'
                  }`}
                >
                  DISCARD ({discardsLeft})
                </button>

                <button
                  onClick={handlePlayHand}
                  disabled={handsLeft <= 0 || selectedCardIds.length === 0 || gamePhase === 'scoring'}
                  className={`px-8 py-3 rounded-xl border-2 font-extrabold text-base shadow-2xl transition-all ${
                    handsLeft <= 0 || selectedCardIds.length === 0 || gamePhase === 'scoring'
                      ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-blue-300 text-white active:scale-95 cursor-pointer'
                  }`}
                >
                  PLAY HAND ({handsLeft})
                </button>
              </div>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-gray-300 shadow cursor-pointer"
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOP VIEW */}
      {gamePhase === 'shop' && (
        <ShopView
          money={money}
          shopJokers={shopJokers}
          shopConsumables={shopConsumables}
          rerollCost={rerollCost}
          onBuyJoker={handleBuyJoker}
          onBuyConsumable={handleBuyConsumable}
          onReroll={handleRerollShop}
          onNextRound={handleNextBlind}
          userJokers={userJokers}
          userConsumables={userConsumables}
          onSellJoker={handleSellJoker}
        />
      )}

      {/* MODALS */}
      {showDeckModal && <DeckViewModal deck={fullDeck} onClose={() => setShowDeckModal(false)} />}
      {showSettingsModal && (
        <SettingsModal
          crtEnabled={crtEnabled}
          setCrtEnabled={setCrtEnabled}
          gameSpeed={gameSpeed}
          setGameSpeed={setGameSpeed}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {gamePhase === 'gameover' && (
        <GameOverModal
          isVictory={roundScore >= targetScore && ante >= 8}
          ante={ante}
          scoreAchieved={roundScore}
          targetScore={targetScore}
          onRestart={startNewRun}
        />
      )}
    </div>
  );
};

export default App;
