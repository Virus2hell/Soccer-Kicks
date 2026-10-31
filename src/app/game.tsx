'use no memo';
// ^ match state is mutated in place every frame; keep React Compiler out of it.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { MatchView } from '@/components/game/match-view';
import { Button, COLORS } from '@/components/ui/kit';
import { isPuckColor } from '@/game/colors';
import { SideSetup, matchResultFor } from '@/game/match';
import { createDefaultPucks } from '@/game/pucks';
import type { MatchSettings, Profile } from '@/game/types';
import { useAuth } from '@/lib/auth';
import { useLocalMatch, useOnlineMatch } from '@/lib/use-match';

type Params = { mode?: string; matchMode?: string; value?: string; p2?: string; p2color?: string };

const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function GameScreen() {
  const params = useLocalSearchParams<Params>();
  const { profile } = useAuth();

  if (!profile) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#04150b' }}>
      <StatusBar hidden />
      {params.mode === 'online' ? <OnlineGame /> : <LocalGame params={params} profile={profile} />}
    </View>
  );
}

const fromProfile = (p: Profile): SideSetup => ({
  name: p.username,
  color: p.color,
  formation: p.formation,
  pucks: p.pucks,
  lineup: p.lineup,
});

function LocalGame({ params, profile }: { params: Params; profile: Profile }) {
  const { call } = useAuth();
  const [setup] = useState(() => {
    const value = Number(params.value) || 5;
    const settings: MatchSettings =
      params.matchMode === 'goals' ? { mode: 'goals', minutes: 0, goals: value } : { mode: 'time', minutes: value, goals: 0 };
    const guestPucks = createDefaultPucks();
    const guest: SideSetup = {
      name: params.p2 || 'Guest',
      color: isPuckColor(params.p2color) ? params.p2color : 'red',
      formation: '2-2',
      pucks: guestPucks,
      lineup: guestPucks.map((p) => p.id),
    };
    return { settings, home: fromProfile(profile), guest };
  });

  const { state, pos, send, restart, paused, setPaused } = useLocalMatch(setup.settings, setup.home, setup.guest);
  const [reward, setReward] = useState<number | null>(null);
  const reported = useRef(false);

  // Save the result to your profile once the match is over
  useEffect(() => {
    if (state.phase !== 'over' || reported.current) return;
    reported.current = true;
    call<{ reward: number }>('profile:localResult', { result: matchResultFor(state, 0) })
      .then((res) => setReward(res.reward))
      .catch(() => setReward(null));
  });

  const playAgain = () => {
    reported.current = false;
    setReward(null);
    restart();
  };

  return (
    <MatchView
      state={state}
      pos={pos}
      canControl={() => true}
      send={send}
      onExit={exit}
      reward={reward}
      onRestart={playAgain}
      onPause={setPaused}
      paused={paused}
    />
  );
}

function OnlineGame() {
  const { state, pos, team, reward, error, send, leave } = useOnlineMatch();

  // Leaving the screen (back button too) = leaving the match
  useEffect(() => () => leave(), [leave]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ color: COLORS.text, fontSize: 16 }}>{error}</Text>
        <Button title="Back" onPress={exit} />
      </View>
    );
  }
  if (!state || team === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <MatchView state={state} pos={pos} canControl={(t) => t === team} send={(input) => send(input)} onExit={exit} reward={reward} />
  );
}
