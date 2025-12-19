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
export const QrCode = createIcon(<><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3" /><path d="M21 21h-3" /><path d="M12 7v3" /><path d="M7 12h3" /></>);
export const Copy = createIcon(<><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2" /></>);
export const Check = createIcon(<><polyline points="20 6 9 17 4 12" /></>);
export const Edit = createIcon(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>);
export const Calendar = createIcon(<><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>);
export const Trash2 = createIcon(<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>);
export const Download = createIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
export const Filter = createIcon(<><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></>);
export const Menu = createIcon(<><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" /></>);
export const X = createIcon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
export const Bell = createIcon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>);
export const LogOut = createIcon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>);
export const User = createIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const Settings = createIcon(<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>);
export const ChevronDown = createIcon(<><polyline points="6 9 12 15 18 9" /></>);
export const Building2 = createIcon(<><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12h12" /><path d="M6 16h12" /><path d="M6 20h12" /><path d="M10 6h4" /><path d="M10 8h4" /><path d="M10 10h4" /></>);
export const BarChart3 = createIcon(<><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>);
export const Receipt = createIcon(<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M14 8H8" /><path d="M16 12H8" /><path d="M13 16H8" /></>);
export const Database = createIcon(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>);
export const Lock = createIcon(<><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
export const Mail = createIcon(<><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>);
export const Send = createIcon(<><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9 22 2z" /></>);
export const EyeOff = createIcon(<><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></>);
export const TrendingUp = createIcon(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>);
export const DollarSign = createIcon(<><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>);
export const Loader2 = createIcon(<><path d="M21 12a9 9 0 1 1-6.219-8.56" /></>);
export const AlertCircle = createIcon(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>);
export const XCircle = createIcon(<><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>);
export const UserPlus = createIcon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>);
export const Plus = createIcon(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
export const FileInvoice = Receipt;
export const Globe = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 0 0 20" />
    <path d="M12 2a15.3 15.3 0 0 1 0 20" />
  </>,
);
export const Key = createIcon(<><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-1 1M3 20l1-1M15 2l4 4M7 20l-4-4" /></>);
export const Phone = createIcon(<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></>);
export const MessageSquare = createIcon(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>);
export const Code = createIcon(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>);
export const Save = createIcon(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>);
export const CheckCircle = createIcon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
export const ArrowLeft = createIcon(<><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>);
export const ChevronLeft = createIcon(<><path d="m15 18-6-6 6-6" /></>);
export const ChevronRight = createIcon(<><path d="m9 18 6-6-6-6" /></>);

// Additional icons for UX improvements
export const Home = createIcon(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>);
export const Info = createIcon(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>);
export const HelpCircle = createIcon(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>);
export const ArrowRight = createIcon(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>);
export const Command = createIcon(<><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" /></>);
export const RefreshCw = createIcon(<><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>);
export const ExternalLink = createIcon(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>);
export const Inbox = createIcon(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>);
export const Banknote = createIcon(<><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>);
export const Hotel = createIcon(<><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" /><path d="m9 16 .348-.24c1.465-1.013 3.84-1.013 5.304 0L15 16" /><path d="M8 7h.01" /><path d="M16 7h.01" /><path d="M12 7h.01" /><path d="M12 11h.01" /><path d="M16 11h.01" /><path d="M8 11h.01" /><path d="M10 22v-6.5m4 0V22" /></>);
