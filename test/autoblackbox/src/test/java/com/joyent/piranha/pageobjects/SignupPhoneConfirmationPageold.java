package com.joyent.piranha.pageobjects;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class SignupPhoneConfirmationPageold {

    public static void clickVerifyButton() {
        $(byText("Verify")).click();
    }

    public static SelenideElement callMeNowBtn() {
        return $(byText("Call Me Now"));
    }

    public static void setPinCode(String pinCode) {
        SelenideElement pinCodeField = $("[data-ng-model=\"pin\"]");
        pinCodeField.clear();
        pinCodeField.sendKeys(pinCode);
    }

    public static void checkSelectedCountryCode(String countryCode) {
        $(".input-group.input-group-inline span").shouldHave(text(countryCode));
    }

    public static void setPhoneNumber(String phoneNumber) {
        SelenideElement phoneNumberField = $("[data-ng-model=\"plainNumber\"]");
        phoneNumberField.clear();
        phoneNumberField.sendKeys(phoneNumber);
    }

    public static SelenideElement getError() {
        return $("[data-ng-repeat=\"notification in group\"]");
    }
}