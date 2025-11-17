import { create } from "zustand";
import { supabase } from "@/utils/supabase/client";
import { UserData, defaultUserData } from "@/types/userData";

interface UserStore {
  // API 요청 상태
  loading: boolean;
  error: string | null;
    
  // 이미지 관련 상태
  profileImageUrl: string | null;
  backgroundImageUrl: string | null;

  // 허브 프로필 토글 상태
  toggle: boolean;
  setToggle: (val: boolean) => void;
  
  userData: UserData | null;   // 사용자 데이터 전체 객체
  hydrated: boolean; // 초기 로딩 완료 여부
  imageVersion: number; // 이미지 캐시 무효화를 위한 버전
  fetchUserData: (userId: string) => Promise<void>; // Supabase에서 사용자 데이터 fetch
  setUserData: (data: UserData) => void; // 로컬 상태에서 userData를 수동으로 설정
  updateUserAnswers: (answers: Partial<UserData>) => Promise<void>; // 특정 필드(answers)를 서버에 업데이트하고 로컬 userData에도 반영
  hydrateUser: () => Promise<void>; // 로그인된 유저 기준으로 userData hydrate
  setProfileImageUrl: (url: string) => void; // 프로필 이미지 URL 설정
  setBackgroundImageUrl: (url: string) => void; // 배경 이미지 URL 설정
  incrementImageVersion: () => void; // imageVersion 증가 (캐시 무효화)
  resetImageState: () => void; // 이미지 관련 상태 초기화
  isHydrating: boolean; // hydrateUser 중복 방지용 플래그
  resetUserState: () => void; // 전체 유저 상태 초기화
}

export const useUserStore = create<UserStore>((set, get) => ({
  // 초기 상태들
  userData: null,      
  loading: false,      
  error: null,         
  hydrated: false,       

  profileImageUrl: null,
  backgroundImageUrl: null,
  imageVersion: 0,     

   // 토글 초기값 및 제어 함수 추가
   toggle: false,
   setToggle: (val) => set({ toggle: val }),

  // hydrateUser 중복 방지용 상태
  isHydrating: false,

  // Supabase에서 사용자 데이터를 불러와 전역 상태에 저장
  fetchUserData: async (userId: string) => {
    set({ loading: true, error: null });
  
    try {
      const { data, error } = await supabase
        .from("Users")
        .select("*")
        .eq("user_id", userId)
        .single();
  
      if (error || !data) {
        throw new Error(error?.message ?? "유저 데이터 없음");
      }
  
      const formatted: UserData = {
        ...defaultUserData,
        ...(data as Partial<UserData>),
      };
  
      set({
        userData: formatted,
        profileImageUrl: formatted.profile_image_url ?? null,
        backgroundImageUrl: formatted.background_image_url ?? null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error("[fetchUserData] 실패:", message);
      set({ error: message, userData: defaultUserData });
    } finally {
      set({ loading: false });
    }
  },

  // 주어진 userData 객체를 전역 상태에 직접 설정
  setUserData: (data) => set({
    userData: data,
    profileImageUrl: data.profile_image_url ?? null,
    backgroundImageUrl: data.background_image_url ?? null,
  }),

  // 특정 필드만 서버에 업데이트하고, 전역 상태에도 반영
  updateUserAnswers: async (answers) => {
    const user = get().userData;
    if (!user?.user_id) return;

    try {
      const { error } = await supabase
        .from("Users")
        .update(answers)
        .eq("user_id", user.user_id);

      if (error) throw new Error(error.message);

      set((state) => ({
        userData: {
          ...state.userData!,
          ...answers,
        },
        profileImageUrl: answers.profile_image_url ?? state.profileImageUrl,
        backgroundImageUrl: answers.background_image_url ?? state.backgroundImageUrl,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "업데이트 실패";
      console.error("업데이트 실패:", message);
    }
  },

  // 현재 로그인된 유저 기준으로 userData 초기화
  hydrateUser: async () => {
    if (get().isHydrating) return;
    set({ isHydrating: true, loading: true, error: null });
  
    try {
      const { data, error } = await supabase.auth.getUser();
  
      if (error) throw new Error(error.message);
  
      const userId = data?.user?.id;
      if (userId) {
        await get().fetchUserData(userId);
      } else {
        console.warn("[hydrateUser] userId 없음 → userData null 설정");
        set({ userData: null });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "초기화 실패";
      console.error("[hydrateUser] 실패:", message);
      set({ error: message, userData: null });
    } finally {
      set({ loading: false, hydrated: true, isHydrating: false });
    }
  },

  // 프로필 이미지 URL만 따로 설정
  setProfileImageUrl: (url) => set({ profileImageUrl: url }),

  // 배경 이미지 URL만 따로 설정
  setBackgroundImageUrl: (url) => set({ backgroundImageUrl: url }),

  // imageVersion 값을 +1 하여 이미지 캐시 무효화 유도
  incrementImageVersion: () =>
    set((state) => ({ imageVersion: state.imageVersion + 1 })),

  // 이미지 관련 상태들을 초기화
  resetImageState: () =>
    set({
      profileImageUrl: null,
      backgroundImageUrl: null,
      imageVersion: 0,
    }),

  // 세션 전환/로그아웃 시 전체 유저 상태 초기화
  resetUserState: () => set({
    userData: null,
    loading: false,
    error: null,
    hydrated: true,
    isHydrating: false,
    profileImageUrl: null,
    backgroundImageUrl: null,
    imageVersion: 0,
    toggle: false
  }),
}));