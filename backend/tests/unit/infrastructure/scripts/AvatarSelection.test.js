/**
 * Test suite for HeyGen Avatar Selection Script
 * Validates avatar selection criteria and scoring
 */

import { describe, it, expect, jest } from '@jest/globals';
import { selectAvatar } from '../../../../scripts/fetch-heygen-avatar.js';

describe('Avatar Selection Script', () => {
  describe('Avatar Selection Criteria', () => {
    it('should select public avatar with highest score', () => {
      const avatars = [
        {
          avatar_id: 'avatar-1',
          name: 'Professional Female',
          gender: 'female',
          style: 'professional',
          is_public: true,
          category: 'professional',
        },
        {
          avatar_id: 'avatar-2',
          name: 'Natural Neutral',
          gender: 'neutral',
          style: 'natural',
          is_public: true,
          category: 'natural',
        },
        {
          avatar_id: 'avatar-3',
          name: 'Child Character',
          gender: 'female',
          style: 'cartoon',
          is_public: true,
          category: 'child',
        },
        {
          avatar_id: 'avatar-4',
          name: 'Premium Avatar',
          gender: 'female',
          style: 'professional',
          is_public: false,
          premium: true,
        },
      ];

      const selected = selectAvatar(avatars);

      // Should select avatar-1 or avatar-2 (both have high scores)
      expect(selected).not.toBeNull();
      expect(selected.avatar_id).not.toBe('avatar-3'); // Child should be disqualified
      expect(selected.avatar_id).not.toBe('avatar-4'); // Premium should be filtered out
      expect(['avatar-1', 'avatar-2']).toContain(selected.avatar_id);
      expect(selected.score).toBeGreaterThanOrEqual(0);
    });

    it('should disqualify child/cartoon/robot avatars', () => {
      const avatars = [
        {
          avatar_id: 'child-avatar',
          name: 'Child Character',
          gender: 'female',
          style: 'child',
          is_public: true,
          category: 'child',
        },
        {
          avatar_id: 'cartoon-avatar',
          name: 'Cartoon Character',
          gender: 'neutral',
          style: 'cartoon',
          is_public: true,
          category: 'cartoon',
        },
        {
          avatar_id: 'robot-avatar',
          name: 'Robot Character',
          gender: 'neutral',
          style: 'robot',
          is_public: true,
          category: 'robot',
        },
        {
          avatar_id: 'professional-avatar',
          name: 'Professional Neutral',
          gender: 'neutral',
          style: 'professional',
          is_public: true,
          category: 'professional',
        },
      ];

      const selected = selectAvatar(avatars);

      expect(selected).not.toBeNull();
      expect(selected.avatar_id).toBe('professional-avatar');
      expect(selected.score).toBeGreaterThanOrEqual(20); // Should have professional bonus
    });

    it('should prefer professional/neutral/natural avatars', () => {
      const avatars = [
        {
          avatar_id: 'basic-avatar',
          name: 'Basic Avatar',
          gender: 'female',
          style: 'normal',
          is_public: true,
        },
        {
          avatar_id: 'professional-avatar',
          name: 'Professional Female',
          gender: 'female',
          style: 'professional',
          is_public: true,
        },
        {
          avatar_id: 'neutral-avatar',
          name: 'Neutral Avatar',
          gender: 'neutral',
          style: 'neutral',
          is_public: true,
        },
      ];

      const selected = selectAvatar(avatars);

      expect(selected).not.toBeNull();
      // Should prefer professional or neutral (both have +20 score)
      expect(['professional-avatar', 'neutral-avatar']).toContain(selected.avatar_id);
      expect(selected.score).toBeGreaterThanOrEqual(20);
    });

    it('should give bonus for female or neutral gender', () => {
      const avatars = [
        {
          avatar_id: 'male-avatar',
          name: 'Male Professional',
          gender: 'male',
          style: 'professional',
          is_public: true,
        },
        {
          avatar_id: 'female-avatar',
          name: 'Female Professional',
          gender: 'female',
          style: 'professional',
          is_public: true,
        },
        {
          avatar_id: 'neutral-avatar',
          name: 'Neutral Professional',
          gender: 'neutral',
          style: 'professional',
          is_public: true,
        },
      ];

      const selected = selectAvatar(avatars);

      expect(selected).not.toBeNull();
      // Should prefer female or neutral (both have +10 gender bonus)
      expect(['female-avatar', 'neutral-avatar']).toContain(selected.avatar_id);
    });

    it('should filter out premium/private avatars', () => {
      const avatars = [
        {
          avatar_id: 'public-avatar',
          name: 'Public Professional',
          gender: 'female',
          style: 'professional',
          is_public: true,
        },
        {
          avatar_id: 'premium-avatar',
          name: 'Premium Professional',
          gender: 'female',
          style: 'professional',
          is_public: false,
          premium: true,
        },
        {
          avatar_id: 'private-avatar',
          name: 'Private Professional',
          gender: 'female',
          style: 'professional',
          is_public: false,
          private: true,
        },
      ];

      const selected = selectAvatar(avatars);

      expect(selected).not.toBeNull();
      expect(selected.avatar_id).toBe('public-avatar');
    });

    it('should return null if no avatars match criteria', () => {
      const avatars = [
        {
          avatar_id: 'child-avatar',
          name: 'Child Character',
          gender: 'female',
          style: 'child',
          is_public: true,
          category: 'child',
        },
        {
          avatar_id: 'cartoon-avatar',
          name: 'Cartoon Character',
          gender: 'neutral',
          style: 'cartoon',
          is_public: true,
          category: 'cartoon',
        },
      ];

      const selected = selectAvatar(avatars);

      // All avatars are disqualified, should return null
      expect(selected).toBeNull();
    });

    it('should return null if no public avatars', () => {
      const avatars = [
        {
          avatar_id: 'premium-1',
          name: 'Premium Avatar 1',
          is_public: false,
          premium: true,
        },
        {
          avatar_id: 'premium-2',
          name: 'Premium Avatar 2',
          is_public: false,
          premium: true,
        },
      ];

      const selected = selectAvatar(avatars);

      expect(selected).toBeNull();
    });

    it('should handle empty avatar list', () => {
      const selected = selectAvatar([]);
      expect(selected).toBeNull();
    });

    it('should handle null avatar list', () => {
      const selected = selectAvatar(null);
      expect(selected).toBeNull();
    });
  });

  describe('Scoring System', () => {
    it('should calculate correct scores', () => {
      const avatars = [
        {
          avatar_id: 'perfect-avatar',
          name: 'Professional Neutral Female',
          gender: 'female',
          style: 'professional',
          is_public: true,
          category: 'professional',
        },
      ];

      const selected = selectAvatar(avatars);

      expect(selected).not.toBeNull();
      // Should have: +20 (professional) + 10 (female) = 30
      expect(selected.score).toBeGreaterThanOrEqual(30);
    });

    it('should apply disqualification penalty', () => {
      const avatars = [
        {
          avatar_id: 'child-professional',
          name: 'Child Professional',
          gender: 'female',
          style: 'professional',
          is_public: true,
          category: 'child',
        },
        {
          avatar_id: 'adult-professional',
          name: 'Adult Professional',
          gender: 'female',
          style: 'professional',
          is_public: true,
          category: 'professional',
        },
      ];

      const selected = selectAvatar(avatars);

      expect(selected).not.toBeNull();
      // Child should be disqualified (score < 0), adult should be selected
      expect(selected.avatar_id).toBe('adult-professional');
    });
  });
});

