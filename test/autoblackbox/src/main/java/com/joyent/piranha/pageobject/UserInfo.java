package com.joyent.piranha.pageobject;

import com.codeborne.selenide.Condition;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.Select;

import static com.codeborne.selenide.Selenide.$;

public class UserInfo extends AbstractPageObject {

    public void setFirstName(String firstName) {
        setValue($("#firstName"), firstName);
    }

    public void setLastName(String lastName) {
        setValue($("#lastName"), lastName);
    }

    public void setEmailAddress(String emailAddress) {
        setValue($("#email"), emailAddress);
    }

    public void setUsername(String username) {
        SelenideElement element = $("#login");
        element.waitUntil(Condition.visible, baseTimeout);
        setValue(element, username);
    }

    public void setPassword(String password) {
        setValue($("#password"), password);
    }

    public void setRepeatPassword(String repeatPassword) {
        setValue($("#password_confirmation"), repeatPassword);
    }

    public void setCreditCardNumber(String cardNumber) {
        setValue($("#creditCardNumber"), cardNumber);
    }

    public void setExpireDate(String monthValue, String yearValue) {
        selectFromSelect2("s2id_expirationMonth", monthValue);
        selectFromSelect2("s2id_expirationYear", yearValue);
    }

    public void setCCVCode(String ccvcode) {
        setValue($(By.id("securityCode")), ccvcode);
    }

    public void setAddressLine1(String address) {
        setValue($(By.id("addressLine1")), address);
    }

    public void setCountry(String countryValue) {
        Select country = new Select($(By.id("country")));
        country.selectByVisibleText(countryValue);
    }

    public void setCity(String city) {
        setValue($(By.id("city")), city);
    }

    public void setState(String state) {
        Select stateSel = new Select($(By.id("stateSel")));
        stateSel.selectByVisibleText(state);
    }

    public void setZipCode(String zipCode) {
        setValue($(By.id("zipCode")), zipCode);
    }

    public void setPhone(String phone) {
        setValue($("[name=\"phone\"]"), phone);
    }

    public String getAddress() {
        return $(".page-title").text().equals("User Details") ? $("#address").val() : $("#addressLine1").val();
    }

    public String getCompanyName() {
        return $("#companyName").val();
    }
}
