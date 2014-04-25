package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selenide.$;

public class ChangePassword extends AbstractPageObject {

    public void setOldPassword(String password){
        SelenideElement oldPassword = $("[name=\"oldPassword\"]");
        oldPassword.clear();
        oldPassword.sendKeys(password);
    }

    public void setNewPassword(String testPass){
        $("[name=\"newPassword\"]").sendKeys(testPass);
    }

    public void setConfirmNewPassword(String testPass){
        $("[name=\"newPasswordConfirmation\"]").sendKeys(testPass);
    }

    public void clickSubmitButton(){
        $("[type=\"submit\"]").click();
    }

    public void clickCloseButton(){
        $("button.btn").click();
    }

    public void fillForm(String oldPass, String newPass) {
        setOldPassword(oldPass);
        setNewPassword(newPass);
        setConfirmNewPassword(newPass);
    }
}
