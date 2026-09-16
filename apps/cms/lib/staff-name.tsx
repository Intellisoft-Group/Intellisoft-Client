import { fileUrl } from './api';
import { isOfficeTeam } from './roles';

export function StaffName({
  name,
  role,
  jobTitle,
  avatarUrl,
  avatarPath,
  as: Tag = 'strong',
}: {
  name?: string | null;
  role?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  avatarPath?: string | null;
  as?: 'strong' | 'span';
}) {
  const photo = avatarUrl || fileUrl(avatarPath);
  return (
    <Tag className="ui staff-name">
      {photo ? (
        <img className="profile-pic" src={photo} alt="" />
      ) : (
        <span className="profile-pic profile-pic-fallback">{(name || '?').slice(0, 1)}</span>
      )}
      <span>
        {name || 'Unknown'}
        {jobTitle ? <span className="job-title"> · {jobTitle}</span> : null}
      </span>
      {isOfficeTeam(role) && (
        <span className="verified" title="Intellisoft team" aria-label="Verified Intellisoft team">
          <svg viewBox="0 0 22 22" aria-hidden="true">
            <path d="M20.4 11c-.02-.65-.22-1.28-.57-1.82-.36-.54-.85-.97-1.44-1.25.22-.6.27-1.26.14-1.9-.13-.63-.44-1.21-.88-1.69-.44-.47-.99-.82-1.58-1.01-.6-.18-1.23-.2-1.84-.05-.42-.41-.96-.71-1.55-.87C11.92 2.12 11.46 2 11 2s-.92.12-1.36.35c-.59.16-1.13.46-1.55.87-.6-.15-1.24-.13-1.84.05-.59.19-1.14.54-1.58 1.01-.44.48-.75 1.06-.88 1.69-.13.64-.08 1.3.14 1.9-.59.28-1.08.71-1.44 1.25-.35.54-.55 1.17-.57 1.82.02.64.22 1.27.57 1.81.36.54.85.97 1.44 1.25-.22.61-.27 1.26-.14 1.9.13.63.44 1.22.88 1.69.44.47.99.82 1.58 1.01.6.18 1.23.2 1.84.06.42.4.96.7 1.55.87.44.23.9.35 1.36.35s.92-.12 1.36-.35c.59-.16 1.13-.47 1.55-.87.61.14 1.24.12 1.84-.06.59-.19 1.14-.54 1.58-1.01.44-.47.75-1.06.88-1.69.13-.64.08-1.29-.14-1.9.59-.28 1.08-.71 1.44-1.25.35-.54.55-1.17.57-1.81z" />
            <path d="M9.57 15.15 6.1 11.68l1.27-1.27 2.2 2.2 5.05-5.05 1.27 1.27-6.32 6.32z" />
          </svg>
        </span>
      )}
    </Tag>
  );
}
