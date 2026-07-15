"""Liability waiver / release form attached to each booking."""

from datetime import datetime

ORGANIZER_NAME_EN = "Buggy Dhofar"
ORGANIZER_NAME_AR = "باجي ظفار"
WAIVER_VERSION = "2026-01"


def build_waiver_text(
    *,
    customer_name: str,
    phone: str,
    email: str,
    ride_date: str,
    language: str = "ar",
    signed_at: datetime | None = None,
) -> str:
    signed = signed_at or datetime.utcnow()
    date_label = signed.strftime("%d/%m/%Y")

    if language.startswith("ar"):
        return f"""إقرار وورقة إخلاء مسؤولية

أنا الموقع أدناه:
الاسم: {customer_name}
رقم الهاتف: {phone}
البريد الإلكتروني: {email}

أقرّ بأنني أرغب بالمشاركة في تجربة ركوب دراجات الدفع الرباعي (باجي) التي تنظمها {ORGANIZER_NAME_AR}، وتاريخ الرحلة المحدد {ride_date}، وأعلم أن هذه الرياضة قد تنطوي على بعض المخاطر الناتجة عن:
• القيادة بسرعة أو بتهور.
• عدم التقيد بالتعليمات والإرشادات المقدمة من قبل المسؤولين.
• الخروج عن المسار المحدد وعدم الالتزام بالسير خلف القائد.
• أي تصرف فردي خارج نطاق التنظيم.

وبناءً على ذلك:
1. أتحمل كامل المسؤولية عن نفسي أثناء المشاركة، وأعفي الشركة والمنظمين والموظفين من أي مطالبات أو تعويضات ناتجة عن إصابة أو ضرر جسدي أو مادي قد يحدث بسبب إهمالي أو مخالفتي للتعليمات.
2. أتعهد بالالتزام بجميع القوانين والتعليمات والاشتراطات الأمنية التي يحددها المنظم.
3. أؤكد أنني بصحة جيدة وأملك اللياقة الجسدية التي تؤهلني لممارسة هذه الأنشطة.
4. أقر بأن موافقتي الإلكترونية أدناه تعد بمثابة موافقة صريحة ونهائية على جميع ما ورد أعلاه.

التاريخ: {date_label}
"""

    return f"""Declaration and Liability Waiver

I, the undersigned:
Name: {customer_name}
Mobile: {phone}
Email: {email}

I acknowledge that I wish to participate in the quad-bike (buggy) experience organized by {ORGANIZER_NAME_EN} on {ride_date}, and I understand that this activity may involve risks arising from:
• Driving at speed or recklessly.
• Failure to follow instructions provided by staff.
• Leaving the designated route or not following the guide.
• Any individual conduct outside the organized activity.

Therefore:
1. I accept full responsibility for myself during participation and release the company, organizers, and staff from any claims or compensation arising from injury or physical/material harm caused by my negligence or failure to follow instructions.
2. I agree to comply with all laws, instructions, and safety requirements set by the organizer.
3. I confirm that I am in good health and physically fit to participate in this activity.
4. I agree that my electronic acceptance below constitutes explicit and final consent to all of the above.

Date: {date_label}
"""
