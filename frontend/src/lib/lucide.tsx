import React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

const createIcon = (path: React.ReactNode) =>
  function Icon(props: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={props.width ?? 20}
        height={props.height ?? 20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {path}
      </svg>
    );
  };

export const Briefcase = createIcon(<path d="M3 7h18M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7l2-3h14l2 3M9 7V5h6v2" />);
export const MapPin = createIcon(<><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>);
export const PiggyBank = createIcon(<><path d="M5 11c-1.657 0-3-1.343-3-3s1.343-3 3-3h9a4 4 0 0 1 4 4v6a3 3 0 0 1-3 3H9" /><path d="M5 8v3" /><path d="M3 11h2" /><path d="M16 5V3" /><circle cx="16.5" cy="9.5" r=".5" /><path d="M2 15h2" /><path d="M20 9h1.5a1.5 1.5 0 0 1 0 3H20" /></>);
export const FileText = createIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></>);
export const HardDrive = createIcon(<><rect x="2" y="7" width="20" height="10" rx="2" ry="2" /><line x1="6" y1="11" x2="6" y2="13" /><line x1="10" y1="11" x2="10" y2="13" /></>);
export const ScanLine = createIcon(<><path d="M4 4h5M15 4h5M4 20h5M15 20h5" /><path d="M3 9V5a2 2 0 0 1 2-2h2" /><path d="M19 3h2a2 2 0 0 1 2 2v2" /><path d="M21 15v4a2 2 0 0 1-2 2h-2" /><path d="M5 21H3a2 2 0 0 1-2-2v-2" /></>);
export const LineChart = createIcon(<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /><circle cx="19" cy="9" r="1" /><circle cx="14" cy="14" r="1" /><circle cx="10" cy="10" r="1" /><circle cx="7" cy="13" r="1" /></>);
export const Wallet = createIcon(<><path d="M20 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16" /><path d="M20 6a2 2 0 0 1 2 2v3h-6a2 2 0 0 0 0 4h6v3a2 2 0 0 1-2 2" /><circle cx="16" cy="12" r="1" /></>);
export const Users = createIcon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const UserCog = createIcon(<><circle cx="12" cy="8" r="4" /><path d="M12 14a7 7 0 0 0-7 7" /><path d="M20.7 19a2 2 0 1 1-1.4-1.4" /><path d="M19.5 16.8a2 2 0 0 1 2.7 2.7" /><path d="m21.7 21.7-1.4-1.4" /></>);
export const BadgePercent = createIcon(<><circle cx="12" cy="12" r="9" /><path d="M15 9h.01" /><path d="M9 15h.01" /><path d="m8 16 8-8" /></>);
export const Settings2 = createIcon(<><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></>);
export const Eye = createIcon(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const CheckCircle2 = createIcon(<><path d="M12 22a10 10 0 1 1 10-10" /><path d="m9 12 2 2 4-4" /></>);
export const XOctagon = createIcon(<><path d="m15 9-6 6" /><path d="m9 9 6 6" /><path d="M16.5 3h-9L3 7.5v9L7.5 21h9L21 16.5v-9Z" /></>);
export const CreditCard = createIcon(<><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="6" y1="15" x2="8" y2="15" /><line x1="10" y1="15" x2="14" y2="15" /></>);
export const Shield = createIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></>);
export const PauseCircle = createIcon(<><circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" /></>);
export const CircleSlash = createIcon(<><circle cx="12" cy="12" r="10" /><line x1="9" y1="9" x2="15" y2="15" /></>);
export const UserCheck = createIcon(<><path d="M8 20a4 4 0 0 1 8 0" /><circle cx="12" cy="10" r="4" /><polyline points="16 11 18 13 22 9" /></>);
export const UserX = createIcon(<><path d="M8 20a4 4 0 0 1 8 0" /><circle cx="12" cy="10" r="4" /><line x1="18" y1="8" x2="22" y2="12" /><line x1="22" y1="8" x2="18" y2="12" /></>);
export const Search = createIcon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>);
export const Clock = createIcon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
export const Ban = createIcon(<><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>);
export const AlertTriangle = createIcon(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
export const Package = createIcon(<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>);
export const WalletMinimal = Wallet;
