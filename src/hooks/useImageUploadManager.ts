"use client";

import { useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import { convertToWebp } from "@/utils/Image/convertToWebp";
import { updateUserImage } from "@/components/MyPage/MyInfo/actions/updateUserImage";
import { useToastStore } from "@/stores/useToastStore";
import { DEFAULT_PROFILE_IMAGE, DEFAULT_BACKGROUND_IMAGE, getStoragePath, stripQuery } from "@/utils/Image/imageUtils";
import { useUserStore } from "@/stores/useUserStore";

type UploadType = "profile" | "background";

export function useImageUploadManager(userId: string | null, type: UploadType) {
  const {
    imageVersion,
    incrementImageVersion,
    setProfileImageUrl,
    setBackgroundImageUrl,
    fetchUserData,
  } = useUserStore();

  const { showToast } = useToastStore();
  const defaultImage =  type === "profile" ? DEFAULT_PROFILE_IMAGE : DEFAULT_BACKGROUND_IMAGE; // 기본 이미지 URL
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));  // 비동기 지연을 위한 유틸 함수


  // 이미지 업로드 핸들러
  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        if (!userId) throw new Error("유저 정보 없음");

        const path = getStoragePath(type, userId);

        // 기존 이미지 삭제
        const { error: removeError } = await supabase.storage
          .from("images")
          .remove([path]);

        if (removeError) {
          console.warn("[Upload] 기존 이미지 삭제 실패 (계속 진행):", removeError.message);
        }
        
        // WebP 변환
        const webpFile = await convertToWebp(file, type);
        console.log("[Upload] WebP 변환 완료:", webpFile.size, "bytes");
        
        // 업로드 직전 캐시 무효화를 위한 delay
        await delay(700); 

        // 업로드 (덮어쓰기 허용)
        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(path, webpFile, { upsert: true });

        if (uploadError) throw new Error(uploadError.message);
        console.log("[Upload] Supabase 업로드 성공");

        // 공개 URL
        const { data } = supabase.storage.from("images").getPublicUrl(path);
        const publicUrl = data?.publicUrl;
        if (!publicUrl) throw new Error("공개 URL 생성 실패");

        const cleanUrl = stripQuery(publicUrl);

        // 우선 로컬 상태에 반영 → UI 먼저 반응
        if (type === "profile") {
          setProfileImageUrl(cleanUrl);
        } else {
          setBackgroundImageUrl(cleanUrl);
        }
        incrementImageVersion();

        
        await updateUserImage(type, publicUrl); // Supabase DB 업데이트
        console.log("[Upload] DB 업데이트 완료");

        
        await fetchUserData(userId); // 동기화를 위한 fetch

        showToast("이미지가 변경되었습니다.", "success");
        return publicUrl;
      } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
          console.error("[Upload] 업로드 실패:", errorMessage);
          showToast(`이미지 업로드 실패: ${errorMessage}`, "error");
          return null;
      }
    },
    [
      userId,
      type,
      incrementImageVersion,
      setProfileImageUrl,
      setBackgroundImageUrl,
      fetchUserData,
      showToast,
    ]
  );

  // 기본 이미지로 리셋 핸들러
  const resetImage = useCallback(async () => {
    try {
      if (!userId) throw new Error("유저 정보 없음");

      await updateUserImage(type, defaultImage); // Supabase DB 업데이트

      // 상태 업데이트
      if (type === "profile") {
        setProfileImageUrl(DEFAULT_PROFILE_IMAGE);
      } else {
        setBackgroundImageUrl(DEFAULT_BACKGROUND_IMAGE);
      }
      incrementImageVersion();

      await fetchUserData(userId); // 동기화를 위한 fetch

      showToast("기본 이미지로 변경되었습니다.", "success");
    } catch (err) {
      console.error("[Reset] 기본 이미지 변경 실패:", err);
      showToast("기본 이미지 변경에 실패했습니다.", "error");
    }
  }, [
    userId,
    type,
    defaultImage,
    incrementImageVersion,
    setProfileImageUrl,
    setBackgroundImageUrl,
    fetchUserData,
    showToast
  ]);

  return {
    uploadImage,
    resetImage,
    imageVersion,
  };
}