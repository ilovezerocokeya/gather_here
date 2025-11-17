"use client";

import React, { useMemo } from "react";
import ImageUploader from "@/components/Common/Images/ImageUploader";
import { useUserStore } from "@/stores/useUserStore";
import { useImageUploadManager } from "@/hooks/useImageUploadManager";
import { useToastStore } from "@/stores/useToastStore";
import { DEFAULT_PROFILE_IMAGE, stripQuery } from "@/utils/Image/imageUtils";

interface ProfileImageProps {
  onImageChange?: (url: string) => void;
}

const ProfileImage: React.FC<ProfileImageProps> = ({ onImageChange }) => {
  const {
    userData,
    profileImageUrl,
    imageVersion,
  } = useUserStore();
  const { setProfileImageUrl, incrementImageVersion } = useUserStore.getState();

  const { showToast } = useToastStore();


  // 이미지 업로드 및 초기화 관련 로직 제공 훅
  const { uploadImage, resetImage } = useImageUploadManager(
    userData?.user_id ?? null,
    "profile"
  );

  // 캐시 무효화를 위한 버전 기반 이미지 URL 생성
  const imageUrl = useMemo(() => {
    const base = stripQuery(profileImageUrl ?? DEFAULT_PROFILE_IMAGE);
    const fullUrl = `${base}?v=${imageVersion}`;
    return fullUrl;
  }, [profileImageUrl, imageVersion]);

  // 이미지 업로드 처리 핸들러
  const handleUpload = async (file: File) => {
    const uploadedUrl = await uploadImage(file);

    if (uploadedUrl) {
      const cleanUrl = stripQuery(uploadedUrl);
      onImageChange?.(cleanUrl);            // 폼 로컬 상태 반영
      setProfileImageUrl(cleanUrl);         // 전역 상태 즉시 반영
      incrementImageVersion();              // 캐시 무효화 버전 증가
    }
  };

  // 기본 이미지로 초기화 처리 핸들러
  const handleReset = async () => {
    const currentImage = stripQuery(profileImageUrl ?? "");
    const defaultImage = stripQuery(DEFAULT_PROFILE_IMAGE);
  
    if (currentImage === defaultImage) {
      showToast("이미 기본 이미지입니다.", "info");
      return;
    }
  
    await resetImage();
    onImageChange?.(DEFAULT_PROFILE_IMAGE);      // 폼 로컬 상태 반영
    setProfileImageUrl(DEFAULT_PROFILE_IMAGE);   // 전역 상태 반영
    incrementImageVersion();                     // 캐시 무효화 버전 증가
  };


  return (
    <div className="border-b border-fillNormal pb-6 mb-6">
      <label className="block text-subtitle font-baseBold text-labelNeutral ml-10 mb-4">프로필 사진</label>
      <div className="flex flex-col items-start gap-4">
        <ImageUploader
          key={`profile-${imageVersion}`}
          imageUrl={imageUrl}
          onUpload={handleUpload}
          onError={(msg) => showToast(msg, "error")}
          type="profile"
        />
        <button
          type="button"
          onClick={() => void handleReset()}
          className="mt-4 px-4 py-2 ml-7 bg-primary text-black rounded-md md:hover:bg-gray-700 transition-all duration-200 text-sm"
        >
          기본 이미지로 변경
        </button>
      </div>
    </div>
  );
};

export default ProfileImage;