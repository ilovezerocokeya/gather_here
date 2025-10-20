import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useLikeStore } from "@/stores/useLikeStore";

// 사용자 인증 상태를 정의하는 인터페이스
interface AuthState {
  user: User | null; // 현재 로그인된 사용자 정보
  isAuthenticated: boolean; // 인증 여부 확인
  setUser: (user: User | null, rememberMe?: boolean) => Promise<void>; // 사용자 정보를 설정하는 함수
  resetAuthUser: () => Promise<void>; // 사용자 로그아웃 및 상태 초기화 함수
  authError: string | null; // 인증 과정에서 발생한 오류 메시지 저장
}

// 인증 관련 컨텍스트 생성
const AuthContext = createContext<AuthState | undefined>(undefined);

// 인증 제공 컴포넌트
export const UserAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

  // 사용자 상태 관리
  const [user, setUserState] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const rememberMeRef = useRef<boolean>(false);

  // localStorage에서 rememberMe 값 가져오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rememberMe");
      rememberMeRef.current = saved ? (JSON.parse(saved) as boolean) : false;
    } catch (error) {
      console.error("rememberMe 상태 로드 오류:", error);
      rememberMeRef.current = false;
    }
  }, []);

  // 사용자 정보를 설정하는 함수
  const setAuthUser = useCallback(async (user: User | null, remember = false) => {
    setUserState(user);
    setIsAuthenticated(!!user); // user가 존재하면 true, 없으면 false

    // 상태가 아니라 Ref에 저장
    rememberMeRef.current = remember; 
    
    // rememberMe 값 localStorage에 저장
    localStorage.setItem("rememberMe", JSON.stringify(remember));
    

    // 로그인 성공 시, 좋아요 상태를 서버와 동기화
    if (user) {
      await useLikeStore.getState().syncLikesWithServer(user.id);
    }
  }, []);

  // 사용자 로그아웃 및 상태 초기화 함수
  const resetAuthUser = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const sessionExists = !!data.session;
      const userId = data.session?.user?.id ?? null;

      if (sessionExists) {
        await supabase.auth.signOut();
      } else {
        console.log("로그아웃처리가 된 상태입니다.");
      }

      // 사용자 상태 초기화
      setUserState(null);
      setIsAuthenticated(false);
      setAuthError(null);
      rememberMeRef.current = false;

      // localStorage에서 rememberMe 값 삭제
      localStorage.removeItem("rememberMe");

      // Zustand 상태 초기화 
      if (userId) {
        useLikeStore.getState().reset(userId);
      } else {
        // 유저 ID가 없으면 메모리만 최소 초기화
        useLikeStore.setState({ likedMembers: {} });
      }

    } catch (error) {
      console.error("Supabase 로그아웃 실패:", error);
    }
  }, []);

  // rememberMeRef.current를 useSessionManager에 전달
  useSessionManager(resetAuthUser, rememberMeRef.current, user);

  // 앱 로드 시, 기존 세션이 있는지 확인
  useEffect(() => {
    void (async () => {
      try {
        // 현재 세션 정보를 가져옴
        const { data, error } = await supabase.auth.getSession();

        // 세션이 만료되었거나 존재하지 않으면 로그아웃 처리
        if (error || !data.session?.user) {
          console.warn("세션 만료 또는 로그인 안 됨, 로그아웃 처리");
          // 세션이 없으면 상태만 초기화
          if (!data.session) {
            setUserState(null);
            setIsAuthenticated(false);
          } else {
            await resetAuthUser();
          }
          return;
        }

        // 유저 정보 설정
        await setAuthUser(data.session.user, rememberMeRef.current);
      } catch (error) {
        console.error("세션 확인 중 오류 발생:", error);
      }
    })();
  }, [setAuthUser, resetAuthUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        setUser: setAuthUser,
        resetAuthUser,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 컨텍스트를 쉽게 사용할 수 있도록 하는 훅
export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 UserAuthProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
};

