# Refresh the RD snapshot

Use Google Sheets metadata and read tab Tong_hop_du_an for spreadsheet
1f1vOMxt6fHW-auk2xxiq5ruejH6PXK_gWs1jexW7wyc. Read ranges B6:I1001
and K6:AG1001 as displayed values. Also read Ma_tran_Automation A3:U1002 as displayed values. Column J holds credentials and must
never be fetched. Preserve blank rows for alignment. Do not change Sheets.

Use Sites get_site for project appgprj_6afd6d219e848191aa621bff72cc252d
and confirm owner-only access. Retrieve the current source checkout using
the supported Sites source workflow. Run python3 scripts/sync-rd.py from
the checkout, passing JSON via protected stdin with keys projects,
metrics, and matrix containing the three value arrays and token containing the live
Site service credential from get_site. Keep credentials in tool session
memory, never shell arguments or files. Disable PTY echo before sending
the envelope. The script validates input, writes only changed project
data, and reads the hosted snapshot back. A failed read or write must be
reported without exposing credentials or confidential source data.
