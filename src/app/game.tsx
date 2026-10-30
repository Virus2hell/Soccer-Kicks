'use no memo';
// ^ match state is mutated in place every frame; keep React Compiler out of it.

import * as ScreenOrientation from 'expo-screen-orientation';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { MatchView } from '@/components/game/match-view';
import { Button, COLORS } from '@/components/ui/kit';
import { SideSetup, matchResultFor } from '@/game/match';
import { createDefaultPucks } from '@/game/pucks';
import type { MatchSettings, Profile } from '@/game/types';
import { useAuth } from '@/lib/auth';
import { useLocalMatch, useOnlineMatch } from '@/lib/use-match';

type Params = { mode?: string; matchMode?: string; value?: string; p2?: string };

const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function GameScreen() {
  const params = useLocalSearchParams<Params>();
  const { profile } = useAuth();

  // Landscape only while this screen is open
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  if (!profile) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar hidden />
      {params.mode === 'online' ? <OnlineGame /> : <LocalGame params={params} profile={profile} />}
    </View>
  );
}

const fromProfile = (p: Profile): SideSetup => ({ name: p.username, formation: p.formation, pucks: p.pucks, lineup: p.lineup });

function LocalGame({ params, profile }: { params: Params; profile: Profile }) {
  const { call } = useAuth();
  const [setup] = useState(() => {
    const value = Number(params.value) || 5;
    const settings: MatchSettings =
      params.matchMode === 'goals' ? { mode: 'goals', minutes: 0, goals: value } : { mode: 'time', minutes: value, goals: 0 };
    const guestPucks = createDefaultPucks();
    const guest: SideSetup = { name: params.p2 || 'Guest', formation: '2-2', pucks: guestPucks, lineup: guestPucks.map((p) => p.id) };
    return { settings, home: fromProfile(profile), guest };
  });

  const { state, send, restart } = useLocalMatch(setup.settings, setup.home, setup.guest);
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

  return <MatchView state={state} canControl={() => true} send={send} onExit={exit} reward={reward} onRestart={playAgain} />;
}

function OnlineGame() {
  const { state, team, reward, error, send, leave } = useOnlineMatch();

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

  return <MatchView state={state} canControl={(t) => t === team} send={(input) => send(input)} onExit={exit} reward={reward} />;
}
