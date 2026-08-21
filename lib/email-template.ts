import { isTestEnvironment } from "@/lib/environment";

export function createEmailTemplate(title: string, bodyContent: string) {
  const environmentBanner = isTestEnvironment()
    ? `
      <div style="
        padding: 14px 20px;
        background: #FEF3C7;
        border-bottom: 1px solid #F59E0B;
        color: #92400E;
        font-size: 14px;
        font-weight: bold;
        text-align: center;
      ">
        TEST ENVIRONMENT: This email was generated during Browns Boarding testing.
      </div>
    `
    : "";

  return `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 700px;
      margin: 0 auto;
      background: #FFFDF9;
      border: 1px solid #D9CBB8;
      border-radius: 12px;
      overflow: hidden;
    ">
          ${environmentBanner}
      <div style="
        background: #8B6A4E;
        padding: 24px;
        text-align: center;
      ">
        <h1 style="
          color: #FFFFFF;
          margin: 0;
          font-size: 28px;
        ">
          Browns Boarding
        </h1>
      </div>

      <div style="padding: 30px;">
        <h2 style="
          color: #5C4033;
          margin-top: 0;
        ">
          ${title}
        </h2>

        <div style="
          color: #5C4033;
          line-height: 1.6;
          font-size: 16px;
        ">
          ${bodyContent}
        </div>
      </div>

      <div style="
        padding: 20px;
        background: #F5EFE6;
        border-top: 1px solid #D9CBB8;
        color: #8B6A4E;
        font-size: 14px;
        line-height: 1.5;
      ">
        <strong>Browns Boarding</strong><br />
        Professional Dog Boarding<br />
        Email: brownsboarding@outlook.com
      </div>
    </div>
  `;
}
